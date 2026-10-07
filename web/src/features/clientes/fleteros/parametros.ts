import { z } from "zod";
import { TIPOS_VEHICULO } from "@/domain/catalogos";
import { estaEnRegion } from "@/domain/geo";
import type { OrdenBuscador, RadioBuscador } from "./consultas-sql";

// Filtros del buscador en la URL (formulario GET). Valores inválidos o manipulados caen en el
// valor por defecto: nunca se usan tal cual.

export const REFERENCIAS = ["habitual", "solicitud", "direccion"] as const;
export type Referencia = (typeof REFERENCIAS)[number];

export const RADIOS = ["zona", "5", "10", "20", "50", "todos"] as const;
export const RATINGS_MINIMOS = ["3", "4", "4.5"] as const;
export const ORDENES = ["distancia", "calificacion", "experiencia", "precio"] as const satisfies readonly OrdenBuscador[];

const opcional = <T extends z.ZodTypeAny>(schema: T) => schema.optional().catch(undefined);

const parametrosSchema = z.object({
  ref: z.enum(REFERENCIAS).catch("habitual"),
  solicitud: opcional(z.string().trim().min(1).max(40)),
  lat: opcional(z.coerce.number().finite()),
  lng: opcional(z.coerce.number().finite()),
  dir: opcional(z.string().trim().min(1).max(200)),
  radio: z.enum(RADIOS).catch("zona"),
  vehiculo: opcional(z.enum(TIPOS_VEHICULO)),
  precioMax: opcional(z.coerce.number().int().min(1).max(10_000_000)),
  rating: opcional(z.enum(RATINGS_MINIMOS)),
  orden: z.enum(ORDENES).catch("distancia"),
  todos: opcional(z.literal("1")),
});

export type ParametrosBuscadorUrl = z.output<typeof parametrosSchema>;

export function leerParametrosBuscador(
  searchParams: Record<string, string | string[] | undefined>,
): ParametrosBuscadorUrl {
  const plano = Object.fromEntries(
    Object.entries(searchParams)
      .map(([k, v]) => [k, Array.isArray(v) ? v[0] : v])
      // Un campo vacío del formulario GET es "sin filtro", no un valor inválido.
      .filter(([, v]) => v !== ""),
  );
  return parametrosSchema.parse(plano);
}

/** El punto escrito a mano, solo si es válido y está en la región de servicio. */
export function direccionEscrita(p: ParametrosBuscadorUrl) {
  if (p.lat === undefined || p.lng === undefined) return null;
  const punto = { lat: p.lat, lng: p.lng };
  return estaEnRegion(punto) ? { ...punto, direccion: p.dir ?? "La dirección que elegiste" } : null;
}

export function radioDeUrl(radio: ParametrosBuscadorUrl["radio"]): RadioBuscador {
  if (radio === "zona") return "zona";
  if (radio === "todos") return null;
  return Number(radio);
}
