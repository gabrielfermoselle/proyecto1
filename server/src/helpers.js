import { db } from "./db.js";

// Perfil público de un usuario: nunca exponemos email/teléfono/hash.
export function publicUser(user) {
  if (!user) return null;
  return { id: user.id, name: user.name, role: user.role };
}

// Estadísticas de reputación calculadas a partir de reseñas reales.
export function workerStats(workerId) {
  const reviews = db.reviews.filter((r) => r.workerId === workerId);
  const completedJobs = db.jobs.filter(
    (j) => j.workerId === workerId && j.status === "completed"
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

// Vista pública de un trabajador (perfil del oficio) con datos del usuario dueño.
export function workerCard(worker) {
  const user = db.users.find((u) => u.id === worker.userId);
  return {
    id: worker.id,
    userId: worker.userId,
    name: user ? user.name : "Desconocido",
    oficios: worker.oficios,
    bio: worker.bio,
    hourlyRate: worker.hourlyRate,
    address: worker.address,
    lat: worker.lat,
    lng: worker.lng,
    coverageKm: worker.coverageKm,
    photoUrl: worker.photoUrl,
    portfolio: worker.portfolio || [],
    ...workerStats(worker.id)
  };
}

// ¿Puede este cliente reseñar a este trabajador?
// Solo si existe un trabajo COMPLETADO entre ambos que aún no fue reseñado.
export function reviewableJob(clientId, workerId) {
  return db.jobs.find(
    (j) =>
      j.clientId === clientId &&
      j.workerId === workerId &&
      j.status === "completed" &&
      !db.reviews.some((r) => r.jobId === j.id)
  );
}
