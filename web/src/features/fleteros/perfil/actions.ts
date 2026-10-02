"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { primerPasoPendiente, PASOS_ONBOARDING, pasosCompletos } from "@/domain/onboarding";
import {
  BUCKET_PUBLICO,
  eliminarArchivos,
  prepararSubida,
  rutaSubidaValida,
  urlPublica,
} from "@/features/uploads/storage";
import { ActionError, createFleteroAction, esViolacionUnica } from "@/lib/action";
import { prisma } from "@/lib/prisma";
import { getPerfilFletero } from "./queries";
import {
  datosSchema,
  disponibilidadSchema,
  estadoVehiculoSchema,
  fotoVehiculoSchema,
  tarifasSchema,
  vehiculoEdicionSchema,
  vehiculoSchema,
  zonaSchema,
} from "./schemas";

// Todas las acciones filtran por el `fleteroId` de la sesión: nadie modifica el perfil,
// los vehículos ni las fotos de otro fletero, aunque mande IDs ajenos.

const MAX_VEHICULOS = 10;
const MAX_FOTOS_POR_VEHICULO = 6;
const carpetaFotos = (fleteroId: string) => `vehiculos/${fleteroId}`;

const PATENTE_EN_USO = "Esa patente ya está registrada en la plataforma.";
const VEHICULO_NO_ENCONTRADO = "No encontramos ese vehículo.";

function refrescar() {
  revalidatePath("/fletero", "layout");
}

export const guardarDatos = createFleteroAction({
  schema: datosSchema,
  requiereOnboarding: false,
  handler: async ({ nombre, apellido, telefono, dni, bio }, { usuario, fleteroId }) => {
    try {
      await prisma.$transaction([
        prisma.user.update({ where: { id: usuario.id }, data: { nombre, apellido, telefono } }),
        prisma.fleteroProfile.update({ where: { id: fleteroId }, data: { dni, bio } }),
      ]);
    } catch (error) {
      if (esViolacionUnica(error, "dni")) {
        throw new ActionError("Ese DNI ya está registrado.", { dni: ["Ese DNI ya está registrado."] });
      }
      throw error;
    }
    refrescar();
    return null;
  },
});

export const crearVehiculo = createFleteroAction({
  schema: vehiculoSchema,
  requiereOnboarding: false,
  handler: async (datos, { fleteroId }) => {
    const cantidad = await prisma.vehiculo.count({ where: { fleteroId } });
    if (cantidad >= MAX_VEHICULOS) throw new ActionError(`Podés cargar hasta ${MAX_VEHICULOS} vehículos.`);
    try {
      const vehiculo = await prisma.vehiculo.create({ data: { ...datos, fleteroId }, select: { id: true } });
      refrescar();
      return vehiculo;
    } catch (error) {
      if (esViolacionUnica(error, "patente"))
        throw new ActionError(PATENTE_EN_USO, { patente: [PATENTE_EN_USO] });
      throw error;
    }
  },
});

export const actualizarVehiculo = createFleteroAction({
  schema: vehiculoEdicionSchema,
  requiereOnboarding: false,
  handler: async ({ id, ...datos }, { fleteroId }) => {
    try {
      const { count } = await prisma.vehiculo.updateMany({ where: { id, fleteroId }, data: datos });
      if (count === 0) throw new ActionError(VEHICULO_NO_ENCONTRADO);
    } catch (error) {
      if (esViolacionUnica(error, "patente"))
        throw new ActionError(PATENTE_EN_USO, { patente: [PATENTE_EN_USO] });
      throw error;
    }
    refrescar();
    return null;
  },
});

/** Baja lógica: el vehículo queda en los fletes y presupuestos históricos. */
export const cambiarEstadoVehiculo = createFleteroAction({
  schema: estadoVehiculoSchema,
  requiereOnboarding: false,
  handler: async ({ id, activo }, { usuario, fleteroId }) => {
    if (!activo && usuario.fleteroProfile?.onboardingCompletadoEn) {
      const activos = await prisma.vehiculo.count({ where: { fleteroId, activo: true, id: { not: id } } });
      if (activos === 0)
        throw new ActionError("Tenés que tener al menos un vehículo activo para recibir solicitudes.");
    }
    const { count } = await prisma.vehiculo.updateMany({ where: { id, fleteroId }, data: { activo } });
    if (count === 0) throw new ActionError(VEHICULO_NO_ENCONTRADO);
    refrescar();
    return null;
  },
});

export const guardarZona = createFleteroAction({
  schema: zonaSchema,
  requiereOnboarding: false,
  handler: async (zona, { fleteroId }) => {
    await prisma.fleteroProfile.update({ where: { id: fleteroId }, data: zona });
    refrescar();
    return null;
  },
});

/**
 * Último paso del onboarding: guarda las tarifas y, si ya está todo completo, habilita la
 * cuenta. Si falta algo, devuelve qué pasos quedan pendientes.
 */
export const guardarTarifas = createFleteroAction({
  schema: tarifasSchema,
  requiereOnboarding: false,
  handler: async (tarifas, { fleteroId }) => {
    await prisma.fleteroProfile.update({ where: { id: fleteroId }, data: tarifas });
    const { progreso, onboardingCompleto } = await getPerfilFletero(fleteroId);
    const pendiente = primerPasoPendiente(progreso);
    if (!pendiente && !onboardingCompleto) {
      await prisma.fleteroProfile.update({
        where: { id: fleteroId },
        data: { onboardingCompletadoEn: new Date() },
      });
    }
    refrescar();
    const completos = pasosCompletos(progreso);
    return { completo: pendiente === null, pendientes: PASOS_ONBOARDING.filter((p) => !completos[p]) };
  },
});

export const guardarDisponibilidad = createFleteroAction({
  schema: disponibilidadSchema,
  handler: async ({ disponible }, { fleteroId }) => {
    await prisma.fleteroProfile.update({ where: { id: fleteroId }, data: { disponible } });
    refrescar();
    return { disponible };
  },
});

// --- Fotos de vehículos (requieren Supabase Storage configurado; bucket público) ---

async function assertVehiculoPropio(vehiculoId: string, fleteroId: string) {
  const vehiculo = await prisma.vehiculo.findFirst({
    where: { id: vehiculoId, fleteroId },
    select: { _count: { select: { fotos: true } } },
  });
  if (!vehiculo) throw new ActionError(VEHICULO_NO_ENCONTRADO);
  return vehiculo._count.fotos;
}

export const firmarSubidaFotoVehiculo = createFleteroAction({
  schema: z.object({ vehiculoId: z.string().min(1).max(40) }),
  requiereOnboarding: false,
  handler: async ({ vehiculoId }, { fleteroId }) => {
    const fotos = await assertVehiculoPropio(vehiculoId, fleteroId);
    if (fotos >= MAX_FOTOS_POR_VEHICULO)
      throw new ActionError(`Podés subir hasta ${MAX_FOTOS_POR_VEHICULO} fotos.`);
    const subida = await prepararSubida(BUCKET_PUBLICO, carpetaFotos(fleteroId));
    if (!subida) throw new ActionError("La carga de fotos todavía no está habilitada.");
    return subida;
  },
});

export const agregarFotoVehiculo = createFleteroAction({
  schema: fotoVehiculoSchema,
  requiereOnboarding: false,
  handler: async ({ vehiculoId, ruta, ancho, alto }, { fleteroId }) => {
    const fotos = await assertVehiculoPropio(vehiculoId, fleteroId);
    if (fotos >= MAX_FOTOS_POR_VEHICULO)
      throw new ActionError(`Podés subir hasta ${MAX_FOTOS_POR_VEHICULO} fotos.`);
    if (!(await rutaSubidaValida(BUCKET_PUBLICO, ruta, carpetaFotos(fleteroId))))
      throw new ActionError("La foto no es válida.");
    const foto = await prisma.foto.create({
      data: { vehiculoId, ruta, ancho, alto },
      select: { id: true, ruta: true, ancho: true, alto: true },
    });
    refrescar();
    return { ...foto, url: urlPublica(foto.ruta) };
  },
});

export const eliminarFotoVehiculo = createFleteroAction({
  schema: z.object({ fotoId: z.string().min(1).max(40) }),
  requiereOnboarding: false,
  handler: async ({ fotoId }, { fleteroId }) => {
    const foto = await prisma.foto.findFirst({
      where: { id: fotoId, vehiculo: { fleteroId } },
      select: { id: true, ruta: true },
    });
    if (!foto) throw new ActionError("No encontramos esa foto.");
    await prisma.foto.delete({ where: { id: foto.id } });
    await eliminarArchivos(BUCKET_PUBLICO, [foto.ruta]);
    refrescar();
    return null;
  },
});
