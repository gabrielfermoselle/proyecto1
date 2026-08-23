import { nanoid } from "nanoid";
import { db, saveDB } from "../db.js";

// { id, userId, especialidad[], descripcion, radioTrabajoKm, latitud, longitud, fotoUrl, disponible, createdAt }

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

export function createPlumber({ userId, especialidad, descripcion, radioTrabajoKm, latitud, longitud, fotoUrl }) {
  const plumber = {
    id: nanoid(10),
    userId,
    especialidad: normalizeEspecialidad(especialidad),
    descripcion: descripcion != null ? String(descripcion) : "",
    radioTrabajoKm: Number(radioTrabajoKm) || 0,
    latitud: latitud != null ? Number(latitud) : null,
    longitud: longitud != null ? Number(longitud) : null,
    fotoUrl: fotoUrl != null ? String(fotoUrl) : "",
    disponible: true,
    createdAt: new Date().toISOString()
  };
  db.plumbers.push(plumber);
  saveDB();
  return plumber;
}

export function updatePlumber(plumber, fields) {
  const { especialidad, descripcion, radioTrabajoKm, latitud, longitud, fotoUrl } = fields || {};
  if (especialidad != null) plumber.especialidad = normalizeEspecialidad(especialidad);
  if (descripcion != null) plumber.descripcion = String(descripcion);
  if (radioTrabajoKm != null) plumber.radioTrabajoKm = Number(radioTrabajoKm) || 0;
  if (latitud != null) plumber.latitud = Number(latitud);
  if (longitud != null) plumber.longitud = Number(longitud);
  if (fotoUrl != null) plumber.fotoUrl = String(fotoUrl);
  saveDB();
  return plumber;
}

export function setDisponibilidad(plumber, disponible) {
  plumber.disponible = Boolean(disponible);
  saveDB();
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
    radioTrabajoKm: plumber.radioTrabajoKm,
    latitud: plumber.latitud,
    longitud: plumber.longitud,
    fotoUrl: plumber.fotoUrl,
    disponible: plumber.disponible,
    createdAt: plumber.createdAt
  };
}
