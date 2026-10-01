import { nanoid } from "nanoid";
import { db, saveDB, usingSupabase } from "../db.js";
import { haversineKm } from "../geo.js";
import { supabase } from "../supabase.js";
import { fleteroCard, round1 } from "../helpers.js";
import { TIPOS_VEHICULO } from "../constants.js";

// { id, usuarioId, tipoVehiculo, vehiculoDescripcion, capacidadKg, descripcion, tarifaBase,
//   direccion, latitud, longitud, radioTrabajoKm, fotoUrl, fotoVehiculoUrl, disponible, creadoEn }

const EDITABLE = {
  tipoVehiculo: (v) => (TIPOS_VEHICULO.includes(v) ? v : undefined),
  vehiculoDescripcion: (v) => String(v),
  capacidadKg: (v) => (v === "" || v == null ? null : Number(v) || 0),
  descripcion: (v) => String(v),
  tarifaBase: (v) => Number(v) || 0,
  direccion: (v) => String(v),
  radioTrabajoKm: (v) => Number(v) || 0,
  latitud: (v) => Number(v),
  longitud: (v) => Number(v),
  fotoUrl: (v) => String(v),
  fotoVehiculoUrl: (v) => String(v)
};

export function findById(id) {
  return db.fleteros.find((f) => f.id === id) || null;
}

export async function createFletero({ usuarioId, tipoVehiculo, radioTrabajoKm }) {
  const fletero = {
    id: nanoid(10),
    usuarioId,
    tipoVehiculo,
    vehiculoDescripcion: "",
    capacidadKg: null,
    descripcion: "",
    tarifaBase: 0,
    direccion: "",
    latitud: null,
    longitud: null,
    radioTrabajoKm: Number(radioTrabajoKm) > 0 ? Number(radioTrabajoKm) : 10,
    fotoUrl: "",
    fotoVehiculoUrl: "",
    disponible: true,
    creadoEn: new Date().toISOString()
  };
  db.fleteros.push(fletero);
  await saveDB();
  return fletero;
}

export async function updateFletero(fletero, fields = {}) {
  for (const [key, parse] of Object.entries(EDITABLE)) {
    if (fields[key] === undefined) continue;
    if ((key === "latitud" || key === "longitud") && fields[key] === null) continue;
    const value = parse(fields[key]);
    if (value !== undefined && !Number.isNaN(value)) fletero[key] = value;
  }
  await saveDB();
  return fletero;
}

export async function setDisponibilidad(fletero, disponible) {
  fletero.disponible = Boolean(disponible);
  await saveDB();
  return fletero;
}

// ---- Búsqueda de fleteros ----
// Filtros: tipoVehiculo, precioMaximo (tarifa base), calificacionMinima y cercanía (lat/lng/radioKm).
// Orden: "distancia" (requiere lat/lng), "calificacion" o "precio".

function applyFilters(list, { tipoVehiculo, precioMaximo, calificacionMinima }) {
  let out = list;
  if (tipoVehiculo) out = out.filter((c) => c.tipoVehiculo === tipoVehiculo);
  if (precioMaximo != null) out = out.filter((c) => c.tarifaBase <= precioMaximo);
  if (calificacionMinima != null) out = out.filter((c) => c.promedioCalificacion >= calificacionMinima);
  return out;
}

function sortList(list, orden, hasOrigin) {
  const sorted = [...list];
  if (orden === "precio") sorted.sort((a, b) => a.tarifaBase - b.tarifaBase);
  else if (orden === "calificacion" || !hasOrigin) {
    sorted.sort((a, b) => b.promedioCalificacion - a.promedioCalificacion);
  } else {
    sorted.sort((a, b) => (a.distanciaKm ?? 1e9) - (b.distanciaKm ?? 1e9));
  }
  return sorted;
}

function searchInMemory(params) {
  const { lat, lng, radioKm } = params;
  const hasOrigin = lat != null && lng != null;
  let list = db.fleteros.map((f) => {
    const card = fleteroCard(f);
    if (hasOrigin && f.latitud != null && f.longitud != null) {
      card.distanciaKm = round1(haversineKm(lat, lng, f.latitud, f.longitud));
      // ¿El punto consultado cae dentro de la zona de trabajo del fletero?
      card.enZona = card.distanciaKm <= (f.radioTrabajoKm || 0);
    } else {
      card.distanciaKm = null;
      card.enZona = null;
    }
    return card;
  });
  if (hasOrigin && radioKm != null) {
    list = list.filter((c) => c.distanciaKm != null && c.distanciaKm <= radioKm);
  }
  return sortList(applyFilters(list, params), params.orden, hasOrigin);
}

// Con Supabase + PostGIS: ST_DWithin filtra por radio y ST_Distance calcula la distancia.
async function searchPostgis(params) {
  const { data, error } = await supabase.rpc("buscar_fleteros", {
    p_lat: params.lat,
    p_lng: params.lng,
    p_radio_km: params.radioKm
  });
  if (error) throw error;
  const distancias = new Map((data || []).map((row) => [row.id, Number(row.distancia_km)]));
  const list = db.fleteros
    .filter((f) => distancias.has(f.id))
    .map((f) => {
      const card = fleteroCard(f);
      card.distanciaKm = round1(distancias.get(f.id));
      card.enZona = card.distanciaKm <= (f.radioTrabajoKm || 0);
      return card;
    });
  return sortList(applyFilters(list, params), params.orden, true);
}

export async function searchFleteros(params) {
  const usePostgis = usingSupabase() && params.lat != null && params.lng != null && params.radioKm != null;
  if (usePostgis) {
    try {
      return await searchPostgis(params);
    } catch (err) {
      console.warn("[fleteros] PostGIS no disponible, usando cálculo local:", err.message);
    }
  }
  return searchInMemory(params);
}
