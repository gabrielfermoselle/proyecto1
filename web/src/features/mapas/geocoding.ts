// Geocodificación con Photon (komoot), sobre datos de OpenStreetMap. A diferencia de
// Nominatim, Photon admite autocompletar mientras se escribe. Se limita a la provincia de Tucumán.
//
// A OpenStreetMap le faltan muchas alturas en Tucumán. Si la calle existe pero la altura no,
// se ofrece la calle con la altura escrita, marcada como aproximada, para que el usuario
// ajuste el pin. Nunca se sugiere otra calle que casualmente tenga ese número.

import { CENTRO_TUCUMAN, haversineKm, REGION_SERVICIO, type Coordenadas } from "@/domain/geo";

const PHOTON = "https://photon.komoot.io";
const BBOX = `${REGION_SERVICIO.lngMin},${REGION_SERVICIO.latMin},${REGION_SERVICIO.lngMax},${REGION_SERVICIO.latMax}`;
const MAX_RESULTADOS = 6;

export interface ResultadoDireccion extends Coordenadas {
  /** Texto para mostrar y guardar, p. ej. "Av. Roca 420, Barrio Sur, San Miguel de Tucumán". */
  direccion: string;
  id: string;
  /** La calle existe pero no esa altura: el punto es de la calle y hay que ajustar el pin. */
  aproximada: boolean;
}

export interface FeaturePhoton {
  geometry: { coordinates: [number, number] };
  properties: {
    osm_id?: number;
    type?: string;
    name?: string;
    street?: string;
    housenumber?: string;
    district?: string;
    locality?: string;
    city?: string;
    county?: string;
    state?: string;
  };
}

type Propiedades = FeaturePhoton["properties"];

const normalizar = (texto: string) =>
  texto
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();

const palabrasDe = (texto: string) =>
  normalizar(texto)
    .split(/[^a-z0-9]+/)
    .filter(Boolean);

const IGNORADAS = new Set([
  "av",
  "avda",
  "avenida",
  "calle",
  "pje",
  "pasaje",
  "bv",
  "bulevar",
  "boulevard",
  "gral",
  "general",
  "dr",
  "doctor",
  "de",
  "del",
  "la",
  "las",
  "los",
  "el",
  "y",
]);

/** Separa lo escrito en palabras de la calle (y la ciudad, si la puso) y la altura. */
export function partesConsulta(texto: string): { palabras: string[]; altura: string | null } {
  const tokens = palabrasDe(texto);
  const iAltura = tokens.findLastIndex((t) => /^\d{1,5}$/.test(t));
  // "24 de Septiembre": un número solo, al principio, es parte del nombre de la calle.
  const altura = iAltura > 0 ? tokens[iAltura]! : null;
  const palabras = tokens.filter(
    (t, i) => (altura === null || i !== iAltura) && t.length > 1 && !IGNORADAS.has(t),
  );
  return { palabras, altura };
}

/** Iguales, o a una letra de distancia en palabras largas ("septiembre" / "setiembre"). */
function parecidas(a: string, b: string): boolean {
  if (a === b || (a.length >= 3 && b.startsWith(a))) return true;
  if (Math.min(a.length, b.length) < 6 || Math.abs(a.length - b.length) > 1) return false;
  let i = 0;
  let j = 0;
  let diferencias = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      i++;
      j++;
      continue;
    }
    if (++diferencias > 1) return false;
    if (a.length > b.length) i++;
    else if (b.length > a.length) j++;
    else {
      i++;
      j++;
    }
  }
  return diferencias + (a.length - i) + (b.length - j) <= 1;
}

/** Cada palabra escrita aparece en la calle o en la zona del resultado (no en el nombre de un local). */
function coincide(calle: string | undefined, p: Propiedades, palabras: string[]): boolean {
  if (!calle) return false;
  const delResultado = palabrasDe(
    [calle, p.district, p.locality, p.city, p.county].filter(Boolean).join(" "),
  );
  return palabras.every((palabra) => delResultado.some((w) => parecidas(palabra, w)));
}

function etiqueta({ name, street, housenumber, district, locality, city, county }: Propiedades): string {
  const calle = street ? [street, housenumber].filter(Boolean).join(" ") : undefined;
  const principal = calle && name && name !== street ? `${name}, ${calle}` : (calle ?? name);
  const partes = [principal, district ?? locality, city ?? county].filter((p): p is string => Boolean(p));
  return [...new Set(partes)].join(", ");
}

function resultado(
  feature: FeaturePhoton,
  i: number,
  props: Propiedades,
  aproximada: boolean,
): ResultadoDireccion {
  const [lng, lat] = feature.geometry.coordinates;
  return { id: `${feature.properties.osm_id ?? i}-${i}`, lat, lng, direccion: etiqueta(props), aproximada };
}

const enTucuman = (f: FeaturePhoton) => normalizar(f.properties.state ?? "") === "tucuman";

/**
 * Se queda con lo que corresponde a lo escrito: con altura, solo esa calle con esa altura
 * (exacta) o esa calle sin la altura (aproximada). Sin altura, todo lo que esté en Tucumán.
 */
export function elegirResultados(features: FeaturePhoton[], texto: string): ResultadoDireccion[] {
  const { palabras, altura } = partesConsulta(texto);
  const resultados = features.filter(enTucuman).flatMap((f, i): ResultadoDireccion[] => {
    const p = f.properties;
    if (!altura) return [resultado(f, i, p, false)];
    if (p.type === "house") {
      return p.housenumber === altura && coincide(p.street, p, palabras) ? [resultado(f, i, p, false)] : [];
    }
    const { name: nombreCalle, ...zona } = p;
    if (p.type === "street" && nombreCalle && coincide(nombreCalle, p, palabras)) {
      return [resultado(f, i, { ...zona, street: nombreCalle, housenumber: altura }, true)];
    }
    return [];
  });
  const vistas = new Set<string>();
  const cercania = (r: ResultadoDireccion) => haversineKm(r, CENTRO_TUCUMAN);
  // Primero las exactas; las aproximadas (misma calle en varias ciudades), de la capital hacia afuera.
  const ordenados = [
    ...resultados.filter((r) => !r.aproximada),
    ...resultados.filter((r) => r.aproximada).sort((a, b) => cercania(a) - cercania(b)),
  ];
  return ordenados
    .filter((r) => r.direccion !== "" && !vistas.has(r.direccion) && vistas.add(r.direccion))
    .slice(0, MAX_RESULTADOS);
}

async function consultar(texto: string, signal?: AbortSignal): Promise<FeaturePhoton[]> {
  const params = new URLSearchParams({
    q: texto,
    limit: "15",
    bbox: BBOX,
    lat: String(CENTRO_TUCUMAN.lat),
    lon: String(CENTRO_TUCUMAN.lng),
  });
  const respuesta = await fetch(`${PHOTON}/api/?${params}`, signal ? { signal } : {});
  if (!respuesta.ok) throw new Error("No pudimos buscar direcciones en este momento.");
  const json = (await respuesta.json()) as { features: FeaturePhoton[] };
  return json.features;
}

export async function buscarDirecciones(texto: string, signal?: AbortSignal): Promise<ResultadoDireccion[]> {
  const encontrados = elegirResultados(await consultar(texto, signal), texto);
  const { altura } = partesConsulta(texto);
  if (encontrados.length > 0 || !altura) return encontrados;
  // Photon a veces no devuelve la calle si la altura no existe: se busca la calle sola.
  const sinAltura = texto.replace(new RegExp(`\\b${altura}\\b`), " ");
  return elegirResultados(await consultar(sinAltura, signal), texto);
}

/** Dirección aproximada de un punto del mapa (cuando el usuario arrastra el pin). */
export async function direccionDePunto(
  { lat, lng }: Coordenadas,
  signal?: AbortSignal,
): Promise<string | null> {
  const params = new URLSearchParams({ lat: String(lat), lon: String(lng), limit: "1" });
  const respuesta = await fetch(`${PHOTON}/reverse?${params}`, signal ? { signal } : {});
  if (!respuesta.ok) return null;
  const json = (await respuesta.json()) as { features: FeaturePhoton[] };
  const primera = json.features[0];
  return primera ? etiqueta(primera.properties) || null : null;
}
