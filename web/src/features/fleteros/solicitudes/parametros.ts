import { z } from "zod";
import { TIPOS_FLETE } from "@/domain/catalogos";
import { sumarDias } from "@/domain/fechas";
import type { FiltrosFeed } from "./consultas-sql";

// Estado del feed en la URL. Valores inválidos o manipulados caen en el valor por defecto.
const parametrosSchema = z.object({
  vista: z.enum(["lista", "mapa"]).catch("lista"),
  orden: z.enum(["distancia", "fecha"]).catch("distancia"),
  pagina: z.coerce.number().int().min(1).max(20).catch(1),
  /** Distancia máxima a la base, en km (siempre dentro del radio de cobertura). */
  zona: z.enum(["todas", "3", "5", "10"]).catch("todas"),
  fecha: z.enum(["todas", "hoy", "manana", "semana"]).catch("todas"),
  tipo: z.enum(["todos", ...TIPOS_FLETE]).catch("todos"),
});

export type ParametrosFeedUrl = z.output<typeof parametrosSchema>;

const DEFAULTS: ParametrosFeedUrl = {
  vista: "lista",
  orden: "distancia",
  pagina: 1,
  zona: "todas",
  fecha: "todas",
  tipo: "todos",
};

export function leerParametrosFeed(
  searchParams: Record<string, string | string[] | undefined>,
): ParametrosFeedUrl {
  const plano = Object.fromEntries(
    Object.entries(searchParams).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]),
  );
  return parametrosSchema.parse(plano);
}

/** Hay algún filtro aplicado (para ofrecer limpiarlos). */
export const hayFiltros = (p: ParametrosFeedUrl) =>
  p.zona !== DEFAULTS.zona || p.fecha !== DEFAULTS.fecha || p.tipo !== DEFAULTS.tipo;

/** Los filtros de la URL, traducidos a la consulta. */
export function filtrosDeParametros(p: ParametrosFeedUrl, hoy: string): FiltrosFeed {
  const rango =
    p.fecha === "hoy"
      ? { desde: hoy, hasta: hoy }
      : p.fecha === "manana"
        ? { desde: sumarDias(hoy, 1), hasta: sumarDias(hoy, 1) }
        : p.fecha === "semana"
          ? { desde: hoy, hasta: sumarDias(hoy, 6) }
          : {};
  return {
    maxKm: p.zona === "todas" ? null : Number(p.zona),
    tipo: p.tipo === "todos" ? null : p.tipo,
    ...rango,
  };
}

/** URL del feed con cambios, omitiendo los valores por defecto para que quede corta. */
export function urlFeed(actual: ParametrosFeedUrl, cambios: Partial<ParametrosFeedUrl> = {}): string {
  const siguiente = { ...actual, pagina: 1, ...cambios };
  const params = new URLSearchParams();
  for (const clave of Object.keys(DEFAULTS) as (keyof ParametrosFeedUrl)[]) {
    if (siguiente[clave] !== DEFAULTS[clave]) params.set(clave, String(siguiente[clave]));
  }
  const query = params.toString();
  return query ? `/fletero?${query}` : "/fletero";
}

export const URL_FEED_SIN_FILTROS = "/fletero";
