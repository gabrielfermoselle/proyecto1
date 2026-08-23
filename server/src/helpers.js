import { db } from "./db.js";

// Perfil público de un usuario: nunca exponemos email/teléfono/hash.
export function publicUser(user) {
  if (!user) return null;
  return { id: user.id, name: user.name, role: user.role };
}

// Estadísticas de reputación calculadas a partir de reseñas reales.
export function plumberStats(plumberId) {
  const reviews = db.reviews.filter((r) => r.plumberId === plumberId);
  const completedJobs = db.jobs.filter(
    (j) => j.plumberId === plumberId && j.status === "completed"
  ).length;
  const avg =
    reviews.length > 0
      ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length
      : 0;
  return {
    reviewCount: reviews.length,
    completedJobs,
    avgRating: Math.round(avg * 10) / 10
  };
}

// Vista pública de un plomero con datos del usuario dueño.
export function plumberCard(plumber) {
  const user = db.users.find((u) => u.id === plumber.userId);
  return {
    id: plumber.id,
    userId: plumber.userId,
    name: user ? user.name : "Desconocido",
    especialidad: plumber.especialidad,
    descripcion: plumber.descripcion,
    hourlyRate: plumber.hourlyRate,
    address: plumber.address,
    latitud: plumber.latitud,
    longitud: plumber.longitud,
    radioTrabajoKm: plumber.radioTrabajoKm,
    fotoUrl: plumber.fotoUrl,
    portfolio: plumber.portfolio || [],
    disponible: plumber.disponible,
    ...plumberStats(plumber.id)
  };
}

// ¿Puede este cliente reseñar a este plomero?
// Solo si existe un trabajo COMPLETADO entre ambos que aún no fue reseñado.
export function reviewableJob(clientId, plumberId) {
  return db.jobs.find(
    (j) =>
      j.clientId === clientId &&
      j.plumberId === plumberId &&
      j.status === "completed" &&
      !db.reviews.some((r) => r.jobId === j.id)
  );
}
