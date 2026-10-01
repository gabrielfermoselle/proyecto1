// Cálculos geográficos puros. La distancia "de ruta" es una estimación: en el Gran
// Tucumán el recorrido real por calles ronda un 30 % más que la línea recta.

export interface Coordenadas {
  lat: number;
  lng: number;
}

/** Radio medio de la Tierra (IUGG), en km. */
const RADIO_TIERRA_KM = 6371.0088;

/** Multiplicador de línea recta a recorrido urbano estimado. */
export const FACTOR_RUTA_URBANA = 1.3;

/** Tamaño de la grilla con la que se aproxima una ubicación (~330 m de latitud). */
const PASO_APROXIMACION_GRADOS = 0.003;

const aRadianes = (grados: number) => (grados * Math.PI) / 180;

export function esCoordenadaValida({ lat, lng }: Coordenadas): boolean {
  return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
}

function assertCoordenada(c: Coordenadas): void {
  if (!esCoordenadaValida(c)) throw new RangeError(`Coordenada inválida: ${c.lat}, ${c.lng}`);
}

/** Distancia en línea recta sobre la esfera (fórmula de Haversine), en km. */
export function haversineKm(a: Coordenadas, b: Coordenadas): number {
  assertCoordenada(a);
  assertCoordenada(b);
  const dLat = aRadianes(b.lat - a.lat);
  const dLng = aRadianes(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(aRadianes(a.lat)) * Math.cos(aRadianes(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * RADIO_TIERRA_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Recorrido estimado por calles, en km. */
export function distanciaRutaKm(a: Coordenadas, b: Coordenadas): number {
  return haversineKm(a, b) * FACTOR_RUTA_URBANA;
}

export function redondear(valor: number, decimales: number): number {
  const factor = 10 ** decimales;
  return Math.round(valor * factor) / factor;
}

/**
 * Ubica el punto en una grilla de ~330 m para mostrar una zona aproximada
 * sin revelar la dirección exacta (privacidad antes de aceptar un presupuesto).
 */
export function aproximarCoordenadas({ lat, lng }: Coordenadas): Coordenadas {
  const ajustar = (v: number) =>
    redondear(Math.round(v / PASO_APROXIMACION_GRADOS) * PASO_APROXIMACION_GRADOS, 6);
  return { lat: ajustar(lat), lng: ajustar(lng) };
}

/** San Miguel de Tucumán: centro por defecto de los mapas. */
export const CENTRO_TUCUMAN: Coordenadas = { lat: -26.8303, lng: -65.2038 };

/** Región donde opera la plataforma (provincia de Tucumán con margen). */
export const REGION_SERVICIO = { latMin: -28.5, latMax: -25.5, lngMin: -66.5, lngMax: -64.0 } as const;

export function estaEnRegion({ lat, lng }: Coordenadas): boolean {
  const r = REGION_SERVICIO;
  return (
    esCoordenadaValida({ lat, lng }) &&
    lat >= r.latMin &&
    lat <= r.latMax &&
    lng >= r.lngMin &&
    lng <= r.lngMax
  );
}
