import "server-only";
import type { PerfilParaOnboarding } from "@/domain/onboarding";
import { fotosHabilitadas } from "@/features/uploads/cloudinary";
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
          fotos: { orderBy: { createdAt: "asc" }, select: { id: true, url: true, ancho: true, alto: true } },
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
  const vehiculos = perfil.vehiculos.map((v) => ({ ...v, volumenM3: v.volumenM3.toNumber() }));

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
    fotosHabilitadas: fotosHabilitadas(),
    progreso,
  };
}

export type PerfilFletero = Awaited<ReturnType<typeof getPerfilFletero>>;
export type VehiculoPerfil = PerfilFletero["vehiculos"][number];
