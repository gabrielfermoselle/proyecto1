import { Router } from "express";
import { db } from "../db.js";
import { authMiddleware } from "../auth.js";
import { puedeChatear } from "../models/Solicitud.js";

const router = Router();

// Historial del chat cliente ↔ fletero de una solicitud (solo los participantes).
router.get("/:solicitudId/:fleteroId", authMiddleware, (req, res) => {
  const { solicitudId, fleteroId } = req.params;
  if (!puedeChatear(req.user.id, solicitudId, fleteroId)) {
    return res.status(403).json({ error: "Sin acceso a este chat" });
  }
  const list = db.mensajes
    .filter((m) => m.solicitudId === solicitudId && m.fleteroId === fleteroId)
    .sort((a, b) => new Date(a.creadoEn) - new Date(b.creadoEn));
  res.json(list);
});

export default router;
