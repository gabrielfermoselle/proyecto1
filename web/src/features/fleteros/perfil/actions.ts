"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { primerPasoPendiente, PASOS_ONBOARDING, pasosCompletos } from "@/domain/onboarding";
import {
  BUCKET_PRIVADO,
  BUCKET_PUBLICO,
  eliminarArchivos,
  prepararSubida,
  rutaSubidaValida,
  urlPublica,
} from "@/features/uploads/storage";
import { ActionError, createFleteroAction, esViolacionUnica } from "@/lib/action";
import { ahoraIso, db, fallar, nuevoId } from "@/lib/db";
import { getPerfilFletero } from "./queries";
import {
  datosSchema,
  disponibilidadSchema,
  documentoSchema,
  estadoVehiculoSchema,
  fotoVehiculoSchema,
  tarifasSchema,
  tipoDocumentoSchema,
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
  revalidatePath("/perfil");
}

async function contarVehiculos(filtro: { fleteroId: string; activo?: boolean; exceptoId?: string }) {
  let q = db().from("vehiculos").select("id", { count: "exact", head: true }).eq("fleteroId", filtro.fleteroId);
  if (filtro.activo !== undefined) q = q.eq("activo", filtro.activo);
  if (filtro.exceptoId) q = q.neq("id", filtro.exceptoId);
  const { count, error } = await q;
  fallar(error);
  return count ?? 0;
}

export const guardarDatos = createFleteroAction({
  schema: datosSchema,
  requiereOnboarding: false,
  handler: async ({ nombre, apellido, telefono, dni, bio }, { usuario, fleteroId }) => {
    try {
      const { error: errorUsuario } = await db()
        .from("usuarios")
        .update({ nombre, apellido, telefono, updatedAt: ahoraIso() })
        .eq("id", usuario.id);
      fallar(errorUsuario);
      const { error: errorPerfil } = await db().from("perfiles_fletero").update({ dni, bio }).eq("id", fleteroId);
      fallar(errorPerfil);
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
    const cantidad = await contarVehiculos({ fleteroId });
    if (cantidad >= MAX_VEHICULOS) throw new ActionError(`Podés cargar hasta ${MAX_VEHICULOS} vehículos.`);
    try {
      const id = nuevoId();
      const { error } = await db().from("vehiculos").insert({ id, ...datos, fleteroId });
      fallar(error);
      refrescar();
      return { id };
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
      const { data, error } = await db()
        .from("vehiculos")
        .update(datos)
        .eq("id", id)
        .eq("fleteroId", fleteroId)
        .select("id");
      fallar(error);
      if (!data || data.length === 0) throw new ActionError(VEHICULO_NO_ENCONTRADO);
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
      const activos = await contarVehiculos({ fleteroId, activo: true, exceptoId: id });
      if (activos === 0)
        throw new ActionError("Tenés que tener al menos un vehículo activo para recibir solicitudes.");
    }
    const { data, error } = await db()
      .from("vehiculos")
      .update({ activo })
      .eq("id", id)
      .eq("fleteroId", fleteroId)
      .select("id");
    fallar(error);
    if (!data || data.length === 0) throw new ActionError(VEHICULO_NO_ENCONTRADO);
    refrescar();
    return null;
  },
});

export const guardarZona = createFleteroAction({
  schema: zonaSchema,
  requiereOnboarding: false,
  handler: async (zona, { fleteroId }) => {
    const { error } = await db().from("perfiles_fletero").update(zona).eq("id", fleteroId);
    fallar(error);
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
    const { error } = await db().from("perfiles_fletero").update(tarifas).eq("id", fleteroId);
    fallar(error);
    const { progreso, onboardingCompleto } = await getPerfilFletero(fleteroId);
    const pendiente = primerPasoPendiente(progreso);
    if (!pendiente && !onboardingCompleto) {
      const { error: errorOnboarding } = await db()
        .from("perfiles_fletero")
        .update({ onboardingCompletadoEn: ahoraIso() })
        .eq("id", fleteroId);
      fallar(errorOnboarding);
    }
    refrescar();
    const completos = pasosCompletos(progreso);
    return { completo: pendiente === null, pendientes: PASOS_ONBOARDING.filter((p) => !completos[p]) };
  },
});

export const guardarDisponibilidad = createFleteroAction({
  schema: disponibilidadSchema,
  handler: async ({ disponible }, { fleteroId }) => {
    const { error } = await db().from("perfiles_fletero").update({ disponible }).eq("id", fleteroId);
    fallar(error);
    refrescar();
    return { disponible };
  },
});

// --- Fotos de vehículos (requieren Supabase Storage configurado; bucket público) ---

async function assertVehiculoPropio(vehiculoId: string, fleteroId: string) {
  const { data, error } = await db()
    .from("vehiculos")
    .select("id, fotos:fotos!fotos_vehiculoId_fkey(id)")
    .eq("id", vehiculoId)
    .eq("fleteroId", fleteroId)
    .maybeSingle();
  fallar(error);
  if (!data) throw new ActionError(VEHICULO_NO_ENCONTRADO);
  const fotos = (data as { fotos: { id: string }[] | null }).fotos;
  return fotos?.length ?? 0;
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
    const id = nuevoId();
    const { error } = await db().from("fotos").insert({ id, vehiculoId, ruta, ancho, alto });
    fallar(error);
    refrescar();
    return { id, ruta, ancho, alto, url: urlPublica(ruta) };
  },
});

export const eliminarFotoVehiculo = createFleteroAction({
  schema: z.object({ fotoId: z.string().min(1).max(40) }),
  requiereOnboarding: false,
  handler: async ({ fotoId }, { fleteroId }) => {
    const { data, error } = await db()
      .from("fotos")
      .select("id, ruta, vehiculo:vehiculos!fotos_vehiculoId_fkey!inner(fleteroId)")
      .eq("id", fotoId)
      .eq("vehiculo.fleteroId", fleteroId)
      .maybeSingle();
    fallar(error);
    const foto = data as { id: string; ruta: string } | null;
    if (!foto) throw new ActionError("No encontramos esa foto.");
    const { error: errorBorrar } = await db().from("fotos").delete().eq("id", foto.id);
    fallar(errorBorrar);
    await eliminarArchivos(BUCKET_PUBLICO, [foto.ruta]);
    refrescar();
    return null;
  },
});

// --- Documentos para la verificación (bucket privado: los ven el fletero y la administración) ---

const carpetaDocumentos = (fleteroId: string) => `documentos/${fleteroId}`;

export const firmarSubidaDocumento = createFleteroAction({
  schema: tipoDocumentoSchema,
  requiereOnboarding: false,
  handler: async (_datos, { fleteroId }) => {
    const subida = await prepararSubida(BUCKET_PRIVADO, carpetaDocumentos(fleteroId));
    if (!subida) throw new ActionError("La carga de fotos todavía no está habilitada.");
    return subida;
  },
});

/** Guarda la foto de un documento; si ya había una de ese tipo, la reemplaza. */
export const guardarDocumento = createFleteroAction({
  schema: documentoSchema,
  requiereOnboarding: false,
  handler: async ({ tipo, ruta }, { fleteroId }) => {
    if (!(await rutaSubidaValida(BUCKET_PRIVADO, ruta, carpetaDocumentos(fleteroId))))
      throw new ActionError("La foto no es válida.");
    const { data: anterior, error: errorBusqueda } = await db()
      .from("documentos_fletero")
      .select("id, ruta")
      .eq("fleteroId", fleteroId)
      .eq("tipo", tipo)
      .maybeSingle();
    fallar(errorBusqueda);
    if (anterior) {
      const { error } = await db()
        .from("documentos_fletero")
        .update({ ruta, createdAt: ahoraIso() })
        .eq("id", anterior.id);
      fallar(error);
    } else {
      const { error } = await db().from("documentos_fletero").insert({ id: nuevoId(), fleteroId, tipo, ruta });
      fallar(error);
    }
    if (anterior) await eliminarArchivos(BUCKET_PRIVADO, [anterior.ruta]);
    refrescar();
    revalidatePath("/admin/fleteros");
    return null;
  },
});

export const eliminarDocumento = createFleteroAction({
  schema: tipoDocumentoSchema,
  requiereOnboarding: false,
  handler: async ({ tipo }, { fleteroId }) => {
    const { data: documento, error } = await db()
      .from("documentos_fletero")
      .select("id, ruta")
      .eq("fleteroId", fleteroId)
      .eq("tipo", tipo)
      .maybeSingle();
    fallar(error);
    if (!documento) throw new ActionError("No encontramos ese documento.");
    const { error: errorBorrar } = await db().from("documentos_fletero").delete().eq("id", documento.id);
    fallar(errorBorrar);
    await eliminarArchivos(BUCKET_PRIVADO, [documento.ruta]);
    refrescar();
    revalidatePath("/admin/fleteros");
    return null;
  },
});
