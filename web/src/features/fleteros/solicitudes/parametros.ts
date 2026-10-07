import { z } from "zod";

// Estado del feed en la URL. Valores inválidos o manipulados caen en el valor por defecto.
const parametrosSchema = z.object({
  tab: z.enum(["nuevas", "presupuestadas"]).catch("nuevas"),
  vista: z.enum(["lista", "mapa"]).catch("lista"),
  orden: z.enum(["distancia", "fecha"]).catch("distancia"),
  pagina: z.coerce.number().int().min(1).max(20).catch(1),
});

export type ParametrosFeedUrl = z.output<typeof parametrosSchema>;

const DEFAULTS: ParametrosFeedUrl = { tab: "nuevas", vista: "lista", orden: "distancia", pagina: 1 };

export function leerParametrosFeed(
  searchParams: Record<string, string | string[] | undefined>,
): ParametrosFeedUrl {
  const plano = Object.fromEntries(
    Object.entries(searchParams).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]),
  );
  return parametrosSchema.parse(plano);
}

/** URL del feed con cambios, omitiendo los valores por defecto para que quede corta. */
export function urlFeed(actual: ParametrosFeedUrl, cambios: Partial<ParametrosFeedUrl> = {}): string {
  const siguiente = { ...actual, pagina: 1, ...cambios };
  const params = new URLSearchParams();
  for (const clave of Object.keys(DEFAULTS) as (keyof ParametrosFeedUrl)[]) {
    if (siguiente[clave] !== DEFAULTS[clave]) params.set(clave, String(siguiente[clave]));
  }
  const query = params.toString();
  return query ? `/fletero/solicitudes?${query}` : "/fletero/solicitudes";
}
