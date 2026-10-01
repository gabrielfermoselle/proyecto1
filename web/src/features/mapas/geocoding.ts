// Geocodificación con Photon (komoot), sobre datos de OpenStreetMap. A diferencia de
// Nominatim, Photon admite autocompletar mientras se escribe. Se limita a la región de servicio.

import { CENTRO_TUCUMAN, REGION_SERVICIO, type Coordenadas } from "@/domain/geo";

const PHOTON = "https://photon.komoot.io";
const BBOX = `${REGION_SERVICIO.lngMin},${REGION_SERVICIO.latMin},${REGION_SERVICIO.lngMax},${REGION_SERVICIO.latMax}`;

export interface ResultadoDireccion extends Coordenadas {
  /** Texto para mostrar y guardar, p. ej. "Av. Roca 420, Barrio Sur, San Miguel de Tucumán". */
  direccion: string;
  id: string;
}

interface FeaturePhoton {
  geometry: { coordinates: [number, number] };
  properties: {
    osm_id?: number;
    name?: string;
    street?: string;
    housenumber?: string;
    district?: string;
    locality?: string;
    city?: string;
    county?: string;
  };
}

function etiqueta({
  name,
  street,
  housenumber,
  district,
  locality,
  city,
  county,
}: FeaturePhoton["properties"]): string {
  const calle = street ? [street, housenumber].filter(Boolean).join(" ") : undefined;
  const principal = calle && name && name !== street ? `${name}, ${calle}` : (calle ?? name);
  const partes = [principal, district ?? locality, city ?? county].filter((p): p is string => Boolean(p));
  return [...new Set(partes)].join(", ");
}

function aResultado(feature: FeaturePhoton, i: number): ResultadoDireccion {
  const [lng, lat] = feature.geometry.coordinates;
  return { id: `${feature.properties.osm_id ?? i}-${i}`, lat, lng, direccion: etiqueta(feature.properties) };
}

export async function buscarDirecciones(texto: string, signal?: AbortSignal): Promise<ResultadoDireccion[]> {
  const params = new URLSearchParams({
    q: texto,
    limit: "6",
    bbox: BBOX,
    lat: String(CENTRO_TUCUMAN.lat),
    lon: String(CENTRO_TUCUMAN.lng),
  });
  const respuesta = await fetch(`${PHOTON}/api/?${params}`, signal ? { signal } : {});
  if (!respuesta.ok) throw new Error("No pudimos buscar direcciones en este momento.");
  const json = (await respuesta.json()) as { features: FeaturePhoton[] };
  return json.features.map(aResultado).filter((r) => r.direccion !== "");
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
  return primera ? aResultado(primera, 0).direccion || null : null;
}
