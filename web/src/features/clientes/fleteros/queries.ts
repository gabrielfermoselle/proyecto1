import "server-only";
import type { Prisma, TipoVehiculo } from "@prisma/client";
import { direccionAproximada } from "@/domain/direccion";
import { nombrePublico } from "@/lib/formato";
import { prisma } from "@/lib/prisma";

// Buscador de fleteros para el cliente. Mismos criterios que el perfil público: solo activos
// y con el onboarding completo, y nunca la dirección exacta de la base.

export type OrdenFleteros = "calificacion" | "experiencia";

export interface FiltrosFleteros {
  tipoVehiculo: TipoVehiculo | null;
  soloDisponibles: boolean;
  orden: OrdenFleteros;
}

const POR_PAGINA = 30;

export async function buscarFleteros(f: FiltrosFleteros) {
  const where: Prisma.FleteroProfileWhereInput = {
    onboardingCompletadoEn: { not: null },
    user: { activo: true },
    ...(f.soloDisponibles ? { disponible: true } : {}),
    vehiculos: { some: { activo: true, ...(f.tipoVehiculo ? { tipo: f.tipoVehiculo } : {}) } },
  };
  const perfiles = await prisma.fleteroProfile.findMany({
    where,
    orderBy:
      f.orden === "calificacion"
        ? [{ ratingPromedio: "desc" }, { cantidadCalificaciones: "desc" }]
        : [{ cantidadCalificaciones: "desc" }, { ratingPromedio: "desc" }],
    take: POR_PAGINA,
    select: {
      id: true,
      bio: true,
      verificado: true,
      disponible: true,
      baseDireccion: true,
      radioCoberturaKm: true,
      ratingPromedio: true,
      cantidadCalificaciones: true,
      user: { select: { nombre: true, apellido: true } },
      vehiculos: { where: { activo: true }, select: { tipo: true, marca: true, modelo: true } },
    },
  });
  const completados = await prisma.flete.groupBy({
    by: ["fleteroId"],
    where: { fleteroId: { in: perfiles.map((p) => p.id) }, etapa: "CERRADO" },
    _count: true,
  });
  const completadosPor = new Map(completados.map((c) => [c.fleteroId, c._count]));

  return perfiles.map((p) => ({
    id: p.id,
    nombre: nombrePublico(p.user.nombre, p.user.apellido),
    bio: p.bio,
    verificado: p.verificado,
    disponible: p.disponible,
    zona: p.baseDireccion ? direccionAproximada(p.baseDireccion) : null,
    radioKm: p.radioCoberturaKm,
    rating: p.cantidadCalificaciones > 0 ? p.ratingPromedio.toNumber() : null,
    calificaciones: p.cantidadCalificaciones,
    fletesCompletados: completadosPor.get(p.id) ?? 0,
    vehiculos: p.vehiculos,
  }));
}

export type FleteroEncontrado = Awaited<ReturnType<typeof buscarFleteros>>[number];
