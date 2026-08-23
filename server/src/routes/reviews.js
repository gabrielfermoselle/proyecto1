import { Router } from "express";
import { nanoid } from "nanoid";
import { db, saveDB } from "../db.js";
import { authMiddleware } from "../auth.js";

const router = Router();

// Reseña ANCLADA A UNA TRANSACCIÓN REAL:
// solo el cliente de un trabajo COMPLETADO puede reseñar, y una única vez.
router.post("/", authMiddleware, (req, res) => {
  if (req.user.role !== "client") {
    return res.status(403).json({ error: "Solo los clientes reseñan" });
  }
  const { jobId, rating, comment } = req.body || {};
  const job = db.jobs.find((j) => j.id === jobId);
  if (!job) return res.status(404).json({ error: "Trabajo no encontrado" });
  if (job.clientId !== req.user.id) {
    return res.status(403).json({ error: "No participaste en este trabajo" });
  }
  if (job.status !== "completed") {
    return res
      .status(400)
      .json({ error: "Solo se puede reseñar un trabajo completado" });
  }
  if (db.reviews.some((r) => r.jobId === job.id)) {
    return res.status(409).json({ error: "Este trabajo ya fue reseñado" });
  }
  const value = Number(rating);
  if (!(value >= 1 && value <= 5)) {
    return res.status(400).json({ error: "La calificación debe ser de 1 a 5" });
  }

  const review = {
    id: nanoid(10),
    jobId: job.id,
    plumberId: job.plumberId,
    clientId: req.user.id,
    rating: value,
    comment: String(comment || "").trim(),
    createdAt: new Date().toISOString()
  };
  db.reviews.push(review);
  saveDB();
  res.json(review);
});

export default router;
