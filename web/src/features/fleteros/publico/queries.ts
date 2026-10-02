import "server-only";
import { cache } from "react";
import { aproximarCoordenadas } from "@/domain/geo";
import { urlPublica } from "@/features/uploads/storage";
import { nombrePublico } from "@/lib/formato";
import { prisma } from "@/lib/prisma";

export const RESENAS_POR_PAGINA = 10;

/**
 * Perfil público de un fletero. Solo fleteros activos con el onboarding completo.
 * Nunca expone teléfono, DNI, patentes ni la dirección exacta de la base.
 */
export const getPerfilPublico = cache(async (fleteroId: string, pagina = 1) => {
  const perfil = await prisma.fleteroProfile.findFirst({
    where: { id: fleteroId, onboardingCompletadoEn: { not: null }, user: { activo: true } },
    select: {
      id: true,
      bio: true,
      verificado: true,
      disponible: true,
      baseLat: true,
      baseLng: true,
      radioCoberturaKm: true,
      ratingPromedio: true,
      cantidadCalificaciones: true,
      user: { select: { nombre: true, apellido: true, createdAt: true } },
      vehiculos: {
        where: { activo: true },
        orderBy: { volumenM3: "asc" },
        select: {
          id: true,
          tipo: true,
          marca: true,
          modelo: true,
          anio: true,
          capacidadKg: true,
          volumenM3: true,
          fotos: { select: { id: true, ruta: true, ancho: true, alto: true } },
        },
      },
    },
  });
  if (!perfil) return null;

  const [completados, distribucion, resenas] = await Promise.all([
    prisma.flete.count({ where: { fleteroId, etapa: "CERRADO" } }),
    prisma.calificacion.groupBy({ by: ["puntaje"], where: { fleteroId }, _count: true }),
    prisma.calificacion.findMany({
      where: { fleteroId },
      orderBy: { createdAt: "desc" },
      skip: (pagina - 1) * RESENAS_POR_PAGINA,
      take: RESENAS_POR_PAGINA + 1,
      select: {
        id: true,
        puntaje: true,
        comentario: true,
        createdAt: true,
        cliente: { select: { user: { select: { nombre: true, apellido: true } } } },
        flete: { select: { solicitud: { select: { tipoFlete: true } } } },
      },
    }),
  ]);

  const conteoPorPuntaje = new Map(distribucion.map((d) => [d.puntaje, d._count]));

  return {
    id: perfil.id,
    nombre: nombrePublico(perfil.user.nombre, perfil.user.apellido),
    miembroDesde: perfil.user.createdAt,
    bio: perfil.bio,
    verificado: perfil.verificado,
    disponible: perfil.disponible,
    zona:
      perfil.baseLat !== null && perfil.baseLng !== null
        ? {
            centro: aproximarCoordenadas({ lat: perfil.baseLat, lng: perfil.baseLng }),
            radioKm: perfil.radioCoberturaKm,
          }
        : null,
    rating: perfil.ratingPromedio.toNumber(),
    cantidadCalificaciones: perfil.cantidadCalificaciones,
    fletesCompletados: completados,
    distribucion: [5, 4, 3, 2, 1].map((puntaje) => ({
      puntaje,
      cantidad: conteoPorPuntaje.get(puntaje) ?? 0,
    })),
    vehiculos: perfil.vehiculos.map((v) => ({
      ...v,
      volumenM3: v.volumenM3.toNumber(),
      fotos: v.fotos.map(({ ruta, ...f }) => ({ ...f, url: urlPublica(ruta) ?? "" })),
    })),
    resenas: resenas.slice(0, RESENAS_POR_PAGINA).map((r) => ({
      id: r.id,
      puntaje: r.puntaje,
      comentario: r.comentario,
      fecha: r.createdAt,
      autor: nombrePublico(r.cliente.user.nombre, r.cliente.user.apellido),
      tipoFlete: r.flete.solicitud.tipoFlete,
    })),
    hayMasResenas: resenas.length > RESENAS_POR_PAGINA,
    pagina,
  };
});
