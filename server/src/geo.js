// GeoJSON Point (longitud, latitud) equivalente a geography(Point, 4326) de PostGIS.
export function toGeographyPoint(latitud, longitud) {
  if (latitud == null || longitud == null) return null;
  const lat = Number(latitud);
  const lng = Number(longitud);
  if (Number.isNaN(lat) || Number.isNaN(lng)) return null;
  return { type: "Point", coordinates: [lng, lat] };
}

// Cálculo de distancia entre dos coordenadas geográficas (fórmula de Haversine).
// Devuelve la distancia en kilómetros. Fallback local de ST_Distance (geography).
export function haversineKm(lat1, lng1, lat2, lng2) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const R = 6371; // radio medio de la Tierra en km
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
