import { Router } from "express";
import { db } from "../db.js";
import { authMiddleware } from "../auth.js";

const router = Router();

// Historial del chat de un trabajo (solo los participantes).
router.get("/:jobId", authMiddleware, (req, res) => {
  const job = db.jobs.find((j) => j.id === req.params.jobId);
  if (!job) return res.status(404).json({ error: "Trabajo no encontrado" });
  const plumber = db.plumbers.find((p) => p.id === job.plumberId);
  const plumberUserId = plumber ? plumber.userId : null;
  if (![job.clientId, plumberUserId].includes(req.user.id)) {
    return res.status(403).json({ error: "Sin acceso a este chat" });
  }
  const list = db.messages
    .filter((m) => m.jobId === job.id)
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  res.json(list);
});

export default router;
