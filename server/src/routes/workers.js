import { Router } from "express";
import { db, saveDB } from "../db.js";
import { authRequired } from "../auth.js";
import { haversineKm } from "../geo.js";
import { workerCard, workerStats } from "../helpers.js";

const router = Router();

// Directorio público con filtros: oficio, texto, y geolocalización (distancia).
router.get("/", (req, res) => {
  const { oficio, q, lat, lng, radius, sort } = req.query;
  const userLat = lat != null ? parseFloat(lat) : null;
  const userLng = lng != null ? parseFloat(lng) : null;
  const maxRadius = radius != null ? parseFloat(radius) : null;

  let list = db.workers
    // Solo mostramos perfiles con al menos un oficio publicado.
    .filter((w) => (w.oficios || []).length > 0)
    .map((w) => {
      const card = workerCard(w);
      if (userLat != null && userLng != null && w.lat != null && w.lng != null) {
        card.distanceKm =
          Math.round(haversineKm(userLat, userLng, w.lat, w.lng) * 10) / 10;
        // Dentro de la zona de cobertura del trabajador?
        card.inCoverage = card.distanceKm <= (w.coverageKm || 0);
      } else {
        card.distanceKm = null;
        card.inCoverage = null;
      }
      return card;
    });

  if (oficio) {
    const o = String(oficio).toLowerCase();
    list = list.filter((c) => c.oficios.some((x) => x.toLowerCase() === o));
  }
  if (q) {
    const term = String(q).toLowerCase();
    list = list.filter(
      (c) =>
        c.name.toLowerCase().includes(term) ||
        c.bio.toLowerCase().includes(term) ||
        c.oficios.some((x) => x.toLowerCase().includes(term))
    );
  }
  // Filtro por distancia máxima solicitada por el usuario.
  if (maxRadius != null && userLat != null && userLng != null) {
    list = list.filter((c) => c.distanceKm != null && c.distanceKm <= maxRadius);
  }

  if (sort === "distance" && userLat != null) {
    list.sort((a, b) => (a.distanceKm ?? 1e9) - (b.distanceKm ?? 1e9));
  } else if (sort === "rating") {
    list.sort((a, b) => b.avgRating - a.avgRating);
  }

  res.json(list);
});

// Lista de oficios disponibles (para filtros).
router.get("/oficios", (_req, res) => {
  const set = new Set();
  db.workers.forEach((w) => (w.oficios || []).forEach((o) => set.add(o)));
  res.json([...set].sort());
});

// Perfil detallado de un trabajador + sus reseñas.
router.get("/:id", (req, res) => {
  const worker = db.workers.find((w) => w.id === req.params.id);
  if (!worker) return res.status(404).json({ error: "Perfil no encontrado" });
  const card = workerCard(worker);
  const reviews = db.reviews
    .filter((r) => r.workerId === worker.id)
    .map((r) => {
      const client = db.users.find((u) => u.id === r.clientId);
      return {
        id: r.id,
        rating: r.rating,
        comment: r.comment,
        clientName: client ? client.name : "Cliente",
        createdAt: r.createdAt
      };
    })
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json({ ...card, reviews });
});

// Actualizar mi propio perfil de oficio (solo trabajadores).
router.put("/me/profile", authRequired, (req, res) => {
  if (req.user.role !== "worker") {
    return res.status(403).json({ error: "Solo para trabajadores" });
  }
  const worker = db.workers.find((w) => w.userId === req.user.id);
  if (!worker) return res.status(404).json({ error: "Perfil no encontrado" });

  const { oficios, bio, hourlyRate, lat, lng, address, coverageKm, photoUrl, portfolio } =
    req.body || {};

  if (Array.isArray(oficios)) worker.oficios = oficios.map((s) => String(s).trim()).filter(Boolean);
  if (bio != null) worker.bio = String(bio);
  if (hourlyRate != null) worker.hourlyRate = Number(hourlyRate) || 0;
  if (lat != null) worker.lat = Number(lat);
  if (lng != null) worker.lng = Number(lng);
  if (address != null) worker.address = String(address);
  if (coverageKm != null) worker.coverageKm = Number(coverageKm) || 0;
  if (photoUrl != null) worker.photoUrl = String(photoUrl);
  if (Array.isArray(portfolio)) worker.portfolio = portfolio;

  saveDB();
  res.json({ ...workerCard(worker), ...workerStats(worker.id) });
});

export default router;
