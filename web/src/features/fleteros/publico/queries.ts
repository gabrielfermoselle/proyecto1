import "server-only";
import { cache } from "react";
import type { TipoFlete, TipoVehiculo } from "@/domain/catalogos";
import { aproximarCoordenadas } from "@/domain/geo";
import { urlPublica } from "@/features/uploads/storage";
import { nombrePublico } from "@/lib/formato";
import { db, fallar, numero, relacion } from "@/lib/db";

export const RESENAS_POR_PAGINA = 10;

interface FotoFila {
  id: string;
  ruta: string;
  ancho: number | null;
  alto: number | null;
}

interface VehiculoFila {
  id: string;
  tipo: string;
  marca: string;
  modelo: string;
  anio: number | null;
  capacidadKg: number;
  volumenM3: number | string;
  activo: boolean;
  fotos: FotoFila[] | null;
}

interface PerfilFila {
  id: string;
  bio: string | null;
  verificado: boolean;
  disponible: boolean;
  baseLat: number | null;
  baseLng: number | null;
  radioCoberturaKm: number;
  ratingPromedio: number | string;
  cantidadCalificaciones: number;
  user:
    | { nombre: string; apellido: string; createdAt: string }
    | { nombre: string; apellido: string; createdAt: string }[]
    | null;
  vehiculos: VehiculoFila[] | null;
}

interface ResenaFila {
  id: string;
  puntaje: number;
  comentario: string | null;
  createdAt: string;
  cliente:
    | { user: { nombre: string; apellido: string } | { nombre: string; apellido: string }[] | null }
    | { user: { nombre: string; apellido: string } | { nombre: string; apellido: string }[] | null }[]
    | null;
  flete:
    | { solicitud: { tipoFlete: string } | { tipoFlete: string }[] | null }
    | { solicitud: { tipoFlete: string } | { tipoFlete: string }[] | null }[]
    | null;
}

/**
 * Perfil público de un fletero. Solo fleteros activos con el onboarding completo.
 * Nunca expone teléfono, DNI, patentes ni la dirección exacta de la base.
 */
export const getPerfilPublico = cache(async (fleteroId: string, pagina = 1) => {
  const { data, error } = await db()
    .from("perfiles_fletero")
    .select(
      `id, bio, verificado, disponible, baseLat, baseLng, radioCoberturaKm, ratingPromedio, cantidadCalificaciones,
       user:usuarios!fletero_profiles_userId_fkey!inner(nombre, apellido, createdAt),
       vehiculos!vehiculos_fleteroId_fkey(id, tipo, marca, modelo, anio, capacidadKg, volumenM3, activo, fotos!fotos_vehiculoId_fkey(id, ruta, ancho, alto))`,
    )
    .eq("id", fleteroId)
    .not("onboardingCompletadoEn", "is", null)
    .eq("user.activo", true)
    .maybeSingle();
  fallar(error);
  const perfil = data as PerfilFila | null;
  if (!perfil) return null;

  const desde = (pagina - 1) * RESENAS_POR_PAGINA;
  const [completados, puntajes, resenas] = await Promise.all([
    (async () => {
      const { count, error: errorConteo } = await db()
        .from("fletes")
        .select("id", { count: "exact", head: true })
        .eq("fleteroId", fleteroId)
        .eq("etapa", "CERRADO");
      fallar(errorConteo);
      return count ?? 0;
    })(),
    (async () => {
      const { data: filas, error: errorPuntajes } = await db()
        .from("calificaciones")
        .select("puntaje")
        .eq("fleteroId", fleteroId);
      fallar(errorPuntajes);
      return (filas ?? []) as { puntaje: number }[];
    })(),
    (async () => {
      const { data: filas, error: errorResenas } = await db()
        .from("calificaciones")
        .select(
          "id, puntaje, comentario, createdAt, cliente:perfiles_cliente!calificaciones_clienteId_fkey(user:usuarios!cliente_profiles_userId_fkey(nombre, apellido)), flete:fletes!calificaciones_fleteId_fkey(solicitud:solicitudes!fletes_solicitudId_fkey(tipoFlete))",
        )
        .eq("fleteroId", fleteroId)
        .order("createdAt", { ascending: false })
        .range(desde, desde + RESENAS_POR_PAGINA);
      fallar(errorResenas);
      return (filas ?? []) as ResenaFila[];
    })(),
  ]);

  const conteoPorPuntaje = new Map<number, number>();
  for (const fila of puntajes) {
    const puntaje = numero(fila.puntaje);
    conteoPorPuntaje.set(puntaje, (conteoPorPuntaje.get(puntaje) ?? 0) + 1);
  }

  const user = relacion(perfil.user);
  if (!user) throw new Error("No se encontró el registro");
  const vehiculos = (perfil.vehiculos ?? [])
    .filter((v) => v.activo)
    .sort((a, b) => numero(a.volumenM3) - numero(b.volumenM3));

  return {
    id: perfil.id,
    nombre: nombrePublico(user.nombre, user.apellido),
    miembroDesde: new Date(user.createdAt),
    bio: perfil.bio,
    verificado: perfil.verificado,
    disponible: perfil.disponible,
    zona:
      perfil.baseLat !== null && perfil.baseLng !== null
        ? {
            centro: aproximarCoordenadas({ lat: numero(perfil.baseLat), lng: numero(perfil.baseLng) }),
            radioKm: perfil.radioCoberturaKm,
          }
        : null,
    rating: numero(perfil.ratingPromedio),
    cantidadCalificaciones: perfil.cantidadCalificaciones,
    fletesCompletados: completados,
    distribucion: [5, 4, 3, 2, 1].map((puntaje) => ({
      puntaje,
      cantidad: conteoPorPuntaje.get(puntaje) ?? 0,
    })),
    vehiculos: vehiculos.map((v) => ({
      id: v.id,
      tipo: v.tipo as TipoVehiculo,
      marca: v.marca,
      modelo: v.modelo,
      anio: v.anio,
      capacidadKg: v.capacidadKg,
      volumenM3: numero(v.volumenM3),
      fotos: (v.fotos ?? []).map(({ ruta, ...f }) => ({ ...f, url: urlPublica(ruta) ?? "" })),
    })),
    resenas: resenas.slice(0, RESENAS_POR_PAGINA).map((r) => {
      const cliente = relacion(relacion(r.cliente)?.user ?? null);
      const solicitud = relacion(relacion(r.flete)?.solicitud ?? null);
      if (!cliente || !solicitud) throw new Error("No se encontró el registro");
      return {
        id: r.id,
        puntaje: r.puntaje,
        comentario: r.comentario,
        fecha: new Date(r.createdAt),
        autor: nombrePublico(cliente.nombre, cliente.apellido),
        tipoFlete: solicitud.tipoFlete as TipoFlete,
      };
    }),
    hayMasResenas: resenas.length > RESENAS_POR_PAGINA,
    pagina,
  };
});
