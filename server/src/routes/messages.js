import { Router } from "express";
import { db } from "../db.js";
import { authRequired } from "../auth.js";

const router = Router();

// Historial del chat de un trabajo (solo los participantes).
router.get("/:jobId", authRequired, (req, res) => {
  const job = db.jobs.find((j) => j.id === req.params.jobId);
  if (!job) return res.status(404).json({ error: "Trabajo no encontrado" });
  const worker = db.workers.find((w) => w.id === job.workerId);
  const workerUserId = worker ? worker.userId : null;
  if (![job.clientId, workerUserId].includes(req.user.id)) {
    return res.status(403).json({ error: "Sin acceso a este chat" });
  }
  const list = db.messages
    .filter((m) => m.jobId === job.id)
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  res.json(list);
});

export default router;
