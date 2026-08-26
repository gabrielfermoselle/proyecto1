import { nanoid } from "nanoid";
import { db, saveDB } from "../db.js";
import { toGeographyPoint, haversineKm } from "../geo.js";
import { supabase, isSupabaseConfigured } from "../supabase.js";
import { plumberCard } from "../helpers.js";

// { id, userId, especialidad[], descripcion, hourlyRate, address, radioTrabajoKm, latitud, longitud, ubicacion: GeoJSON Point, fotoUrl, portfolio[], disponible, createdAt }

export function findById(id) {
  return db.plumbers.find((p) => p.id === id) || null;
}

export function findByUserId(userId) {
  return db.plumbers.find((p) => p.userId === userId) || null;
}

function normalizeEspecialidad(value) {
  if (Array.isArray(value)) return value.map((s) => String(s).trim()).filter(Boolean);
  if (value == null) return [];
  const trimmed = String(value).trim();
  return trimmed ? [trimmed] : [];
}

export async function createPlumber({
  userId,
  especialidad,
  descripcion,
  hourlyRate,
  address,
  radioTrabajoKm,
  latitud,
  longitud,
  fotoUrl,
  portfolio
}) {
  const plumber = {
    id: nanoid(10),
    userId,
    especialidad: normalizeEspecialidad(especialidad),
    descripcion: descripcion != null ? String(descripcion) : "",
    hourlyRate: Number(hourlyRate) || 0,
    address: address != null ? String(address) : "",
    radioTrabajoKm: Number(radioTrabajoKm) || 0,
    latitud: latitud != null ? Number(latitud) : null,
    longitud: longitud != null ? Number(longitud) : null,
    ubicacion: toGeographyPoint(latitud, longitud),
    fotoUrl: fotoUrl != null ? String(fotoUrl) : "",
    portfolio: Array.isArray(portfolio) ? portfolio : [],
    disponible: true,
    createdAt: new Date().toISOString()
  };
  db.plumbers.push(plumber);
  await saveDB();
  return plumber;
}

export async function updatePlumber(plumber, fields) {
  const { especialidad, descripcion, hourlyRate, address, radioTrabajoKm, latitud, longitud, fotoUrl, portfolio } =
    fields || {};
  if (especialidad != null) plumber.especialidad = normalizeEspecialidad(especialidad);
  if (descripcion != null) plumber.descripcion = String(descripcion);
  if (hourlyRate != null) plumber.hourlyRate = Number(hourlyRate) || 0;
  if (address != null) plumber.address = String(address);
  if (radioTrabajoKm != null) plumber.radioTrabajoKm = Number(radioTrabajoKm) || 0;
  if (latitud != null) plumber.latitud = Number(latitud);
  if (longitud != null) plumber.longitud = Number(longitud);
  if (latitud != null || longitud != null) {
    plumber.ubicacion = toGeographyPoint(plumber.latitud, plumber.longitud);
  }
  if (fotoUrl != null) plumber.fotoUrl = String(fotoUrl);
  if (Array.isArray(portfolio)) plumber.portfolio = portfolio;
  await saveDB();
  return plumber;
}

export async function setDisponibilidad(plumber, disponible) {
  plumber.disponible = Boolean(disponible);
  await saveDB();
  return plumber;
}

export function toPublic(plumber) {
  const user = db.users.find((u) => u.id === plumber.userId);
  return {
    id: plumber.id,
    userId: plumber.userId,
    name: user ? user.name : "Desconocido",
    especialidad: plumber.especialidad,
    descripcion: plumber.descripcion,
    hourlyRate: plumber.hourlyRate,
    address: plumber.address,
    radioTrabajoKm: plumber.radioTrabajoKm,
    latitud: plumber.latitud,
    longitud: plumber.longitud,
    fotoUrl: plumber.fotoUrl,
    portfolio: plumber.portfolio || [],
    disponible: plumber.disponible,
    ubicacion: plumber.ubicacion || toGeographyPoint(plumber.latitud, plumber.longitud),
    createdAt: plumber.createdAt
  };
}

function roundKm(value) {
  return Math.round(Number(value) * 10) / 10;
}

function fromProximityRow(row) {
  return {
    id: row.id,
    userId: row.usuario_id,
    name: row.nombre,
    especialidad: row.especialidad || [],
    descripcion: row.descripcion,
    hourlyRate: Number(row.tarifa_hora) || 0,
    address: row.direccion,
    latitud: row.latitud != null ? Number(row.latitud) : null,
    longitud: row.longitud != null ? Number(row.longitud) : null,
    radioTrabajoKm: Number(row.radio_trabajo_km) || 0,
    fotoUrl: row.url_foto || "",
    portfolio: row.portafolio || [],
    disponible: Boolean(row.disponible),
    ubicacion: toGeographyPoint(row.latitud, row.longitud),
    reviewCount: Number(row.cantidad_resenas) || 0,
    completedJobs: Number(row.trabajos_completados) || 0,
    avgRating: roundKm(row.promedio_calificacion || 0),
    distanceKm: roundKm(row.distancia_km)
  };
}

function searchByProximityInMemory({
  lat,
  lng,
  radioKm,
  especialidad,
  calificacionMinima,
  limit,
  offset
}) {
  let list = db.plumbers
    .filter((p) => p.latitud != null && p.longitud != null)
    .map((p) => {
      const distanceKm = haversineKm(lat, lng, p.latitud, p.longitud);
      return {
        card: {
          ...plumberCard(p),
          ubicacion: p.ubicacion || toGeographyPoint(p.latitud, p.longitud),
          distanceKm: roundKm(distanceKm)
        },
        distanceKm
      };
    })
    .filter((item) => item.distanceKm <= radioKm);

  if (especialidad) {
    const e = String(especialidad).toLowerCase();
    list = list.filter((item) => (item.card.especialidad || []).some((x) => x.toLowerCase() === e));
  }
  if (calificacionMinima != null) {
    list = list.filter((item) => item.card.avgRating >= calificacionMinima);
  }

  list.sort((a, b) => a.distanceKm - b.distanceKm);
  const total = list.length;
  const plumbers = list.slice(offset, offset + limit).map((item) => item.card);
  return { plumbers, total, limit, offset };
}

async function searchByProximityPostgis({
  lat,
  lng,
  radioKm,
  especialidad,
  calificacionMinima,
  limit,
  offset
}) {
  const { data, error } = await supabase.rpc("buscar_plomeros", {
    p_lat: lat,
    p_lng: lng,
    p_radio_km: radioKm,
    p_especialidad: especialidad || null,
    p_calificacion_minima: calificacionMinima,
    p_limit: limit,
    p_offset: offset
  });
  if (error) throw error;
  const rows = data || [];
  let total = rows.length ? Number(rows[0].total) || rows.length : 0;
  // ST_DWithin/ST_Distance via window count: si la página queda vacía (offset alto),
  // no llegan filas y hay que leer el total en una consulta de cabecera.
  if (!rows.length && offset > 0) {
    const head = await supabase.rpc("buscar_plomeros", {
      p_lat: lat,
      p_lng: lng,
      p_radio_km: radioKm,
      p_especialidad: especialidad || null,
      p_calificacion_minima: calificacionMinima,
      p_limit: 1,
      p_offset: 0
    });
    if (head.error) throw head.error;
    total = head.data?.length ? Number(head.data[0].total) || 0 : 0;
  }
  return {
    plumbers: rows.map(fromProximityRow),
    total,
    limit,
    offset
  };
}

export async function searchByProximity(params) {
  if (isSupabaseConfigured) {
    try {
      return await searchByProximityPostgis(params);
    } catch (err) {
      console.warn("[plumbers] PostGIS no disponible, usando fallback local:", err.message);
    }
  }
  return searchByProximityInMemory(params);
}
