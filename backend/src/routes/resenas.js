import { Router } from "express";
import { nanoid } from "nanoid";
import { db, saveDB } from "../db.js";
import { authMiddleware, checkRole } from "../auth.js";
import { asyncHandler } from "../helpers.js";

const router = Router();

// Calificación ANCLADA A UN FLETE REAL: solo el cliente de una solicitud
// COMPLETADA (recepción confirmada) puede calificar al fletero, y una única vez.
router.post("/", authMiddleware, checkRole("cliente"), asyncHandler(async (req, res) => {
  const { solicitudId, calificacion, comentario } = req.body || {};
  const solicitud = db.solicitudes.find((s) => s.id === solicitudId);
  if (!solicitud) return res.status(404).json({ error: "Solicitud no encontrada" });
  if (solicitud.clienteId !== req.user.id) {
    return res.status(403).json({ error: "No participaste en este flete" });
  }
  if (solicitud.estado !== "completada") {
    return res.status(400).json({ error: "Solo se puede calificar un flete completado" });
  }
  if (db.resenas.some((r) => r.solicitudId === solicitud.id)) {
    return res.status(409).json({ error: "Este flete ya fue calificado" });
  }
  const value = Number(calificacion);
  if (!(Number.isInteger(value) && value >= 1 && value <= 5)) {
    return res.status(400).json({ error: "La calificación debe ser de 1 a 5" });
  }

  const resena = {
    id: nanoid(10),
    solicitudId: solicitud.id,
    fleteroId: solicitud.fleteroId,
    clienteId: req.user.id,
    calificacion: value,
    comentario: String(comentario || "").trim(),
    creadoEn: new Date().toISOString()
  };
  db.resenas.push(resena);
  await saveDB();
  res.json(resena);
}));

export default router;
