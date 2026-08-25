import { nanoid } from "nanoid";
import { db, saveDB } from "../db.js";

// { id, userId, especialidad[], descripcion, hourlyRate, address, radioTrabajoKm, latitud, longitud, fotoUrl, portfolio[], disponible, createdAt }

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
    createdAt: plumber.createdAt
  };
}
