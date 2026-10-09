import "server-only";
import type { PerfilParaOnboarding } from "@/domain/onboarding";
import { urlPublica, urlsFirmadas } from "@/features/uploads/storage";
import { configPublicaSupabase } from "@/lib/supabase";
import { prisma } from "@/lib/prisma";

/** Perfil completo del fletero para el onboarding y la página de perfil. Siempre por su `fleteroId`. */
export async function getPerfilFletero(fleteroId: string) {
  const perfil = await prisma.fleteroProfile.findUniqueOrThrow({
    where: { id: fleteroId },
    select: {
      dni: true,
      bio: true,
      baseDireccion: true,
      baseLat: true,
      baseLng: true,
      radioCoberturaKm: true,
      precioMinimo: true,
      precioPorKm: true,
      precioPorM3: true,
      precioPorAyudante: true,
      disponible: true,
      onboardingCompletadoEn: true,
      user: { select: { nombre: true, apellido: true, telefono: true } },
      vehiculos: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          tipo: true,
          marca: true,
          modelo: true,
          anio: true,
          patente: true,
          capacidadKg: true,
          volumenM3: true,
          activo: true,
          fotos: { orderBy: { createdAt: "asc" }, select: { id: true, ruta: true, ancho: true, alto: true } },
        },
      },
    },
  });

  const tarifas = {
    precioMinimo: perfil.precioMinimo.toNumber(),
    precioPorKm: perfil.precioPorKm.toNumber(),
    precioPorM3: perfil.precioPorM3.toNumber(),
    precioPorAyudante: perfil.precioPorAyudante.toNumber(),
  };
  const vehiculos = perfil.vehiculos.map((v) => ({
    ...v,
    volumenM3: v.volumenM3.toNumber(),
    fotos: v.fotos.map(({ ruta, ...f }) => ({ ...f, url: urlPublica(ruta) ?? "" })),
  }));

  const progreso: PerfilParaOnboarding = {
    dni: perfil.dni,
    telefono: perfil.user.telefono,
    vehiculosActivos: vehiculos.filter((v) => v.activo).length,
    baseLat: perfil.baseLat,
    baseLng: perfil.baseLng,
    precioMinimo: tarifas.precioMinimo,
    precioPorKm: tarifas.precioPorKm,
  };

  return {
    datos: {
      nombre: perfil.user.nombre,
      apellido: perfil.user.apellido,
      telefono: perfil.user.telefono ?? "",
      dni: perfil.dni ?? "",
      bio: perfil.bio ?? "",
    },
    zona: {
      baseDireccion: perfil.baseDireccion ?? "",
      baseLat: perfil.baseLat,
      baseLng: perfil.baseLng,
      radioCoberturaKm: perfil.radioCoberturaKm,
    },
    tarifas,
    vehiculos,
    disponible: perfil.disponible,
    onboardingCompleto: perfil.onboardingCompletadoEn !== null,
    /** Configuración para subir fotos desde el navegador; null si Storage no está configurado. */
    storage: configPublicaSupabase(),
    progreso,
  };
}

export type PerfilFletero = Awaited<ReturnType<typeof getPerfilFletero>>;
export type VehiculoPerfil = PerfilFletero["vehiculos"][number];

/** Documentos subidos para la verificación, con URLs firmadas (el bucket es privado). */
export async function getDocumentosFletero(fleteroId: string) {
  const [documentos, perfil] = await Promise.all([
    prisma.documentoFletero.findMany({
      where: { fleteroId },
      select: { tipo: true, ruta: true, createdAt: true },
    }),
    prisma.fleteroProfile.findUniqueOrThrow({ where: { id: fleteroId }, select: { verificado: true } }),
  ]);
  const urls = await urlsFirmadas(documentos.map((d) => d.ruta));
  return {
    verificado: perfil.verificado,
    documentos: documentos.map((d) => ({
      tipo: d.tipo,
      subidoEn: d.createdAt,
      url: urls.get(d.ruta) ?? null,
    })),
  };
}

export type DocumentoSubido = Awaited<ReturnType<typeof getDocumentosFletero>>["documentos"][number];
