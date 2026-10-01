import { db } from "./db.js";

export function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

// Reputación calculada a partir de reseñas reales y fletes completados.
export function fleteroStats(fleteroId) {
  const resenas = db.resenas.filter((r) => r.fleteroId === fleteroId);
  const fletesCompletados = db.solicitudes.filter(
    (s) => s.fleteroId === fleteroId && s.estado === "completada"
  ).length;
  const promedio =
    resenas.length > 0 ? resenas.reduce((sum, r) => sum + r.calificacion, 0) / resenas.length : 0;
  return {
    cantidadResenas: resenas.length,
    fletesCompletados,
    promedioCalificacion: Math.round(promedio * 10) / 10
  };
}

// Vista pública de un fletero. Nunca expone correo ni teléfono.
export function fleteroCard(fletero) {
  const usuario = db.usuarios.find((u) => u.id === fletero.usuarioId);
  return {
    id: fletero.id,
    usuarioId: fletero.usuarioId,
    nombre: usuario ? usuario.nombre : "Fletero",
    tipoVehiculo: fletero.tipoVehiculo,
    vehiculoDescripcion: fletero.vehiculoDescripcion || "",
    capacidadKg: fletero.capacidadKg ?? null,
    descripcion: fletero.descripcion || "",
    tarifaBase: fletero.tarifaBase || 0,
    direccion: fletero.direccion || "",
    latitud: fletero.latitud,
    longitud: fletero.longitud,
    radioTrabajoKm: fletero.radioTrabajoKm || 0,
    fotoUrl: fletero.fotoUrl || "",
    fotoVehiculoUrl: fletero.fotoVehiculoUrl || "",
    disponible: fletero.disponible !== false,
    ...fleteroStats(fletero.id)
  };
}

export function fleteroByUsuario(usuarioId) {
  return db.fleteros.find((f) => f.usuarioId === usuarioId) || null;
}

export function nombreUsuario(usuarioId, fallback = "Usuario") {
  const usuario = db.usuarios.find((u) => u.id === usuarioId);
  return usuario ? usuario.nombre : fallback;
}

// Helpers de validación de query params.
export function parseOptionalNumber(value) {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isNaN(n) ? NaN : n;
}

export const round1 = (value) => Math.round(Number(value) * 10) / 10;
