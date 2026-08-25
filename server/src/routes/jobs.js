import { Router } from "express";
import { nanoid } from "nanoid";
import { db, saveDB } from "../db.js";
import { authMiddleware, checkRole } from "../auth.js";
import { asyncHandler } from "../helpers.js";

const router = Router();

// Estados válidos y transiciones permitidas.
const FLOW = {
  requested: ["accepted", "cancelled"],
  accepted: ["started", "cancelled"],
  started: ["completed", "cancelled"],
  completed: [],
  cancelled: []
};

// Estados que solo puede aplicar el plomero (aceptar, iniciar y finalizar el trabajo).
const PLUMBER_ONLY_STATUS = ["accepted", "started", "completed"];

function jobView(job) {
  const client = db.users.find((u) => u.id === job.clientId);
  const plumber = db.plumbers.find((p) => p.id === job.plumberId);
  const plumberUser = plumber ? db.users.find((u) => u.id === plumber.userId) : null;
  const hasReview = db.reviews.some((r) => r.jobId === job.id);
  return {
    ...job,
    clientName: client ? client.name : "Cliente",
    plumberName: plumberUser ? plumberUser.name : "Plomero",
    plumberUserId: plumberUser ? plumberUser.id : null,
    reviewed: hasReview
  };
}

// Verifica que el usuario forme parte del trabajo (cliente o plomero dueño).
function participants(job) {
  const plumber = db.plumbers.find((p) => p.id === job.plumberId);
  return { clientId: job.clientId, plumberUserId: plumber ? plumber.userId : null };
}

// Cliente solicita una contratación a un plomero.
router.post("/", authMiddleware, checkRole("client"), asyncHandler(async (req, res) => {
  const { plumberId, title, description } = req.body || {};
  const plumber = db.plumbers.find((p) => p.id === plumberId);
  if (!plumber) return res.status(404).json({ error: "Plomero no encontrado" });
  if (!title) return res.status(400).json({ error: "Falta el título del trabajo" });

  const job = {
    id: nanoid(10),
    clientId: req.user.id,
    plumberId,
    title: String(title).trim(),
    description: String(description || "").trim(),
    status: "requested",
    agreedPrice: null,
    createdAt: new Date().toISOString(),
    completedAt: null
  };
  db.jobs.push(job);
  await saveDB();
  res.json(jobView(job));
}));

// Lista de contrataciones del usuario autenticado (según su rol).
router.get("/", authMiddleware, (req, res) => {
  let list;
  if (req.user.role === "client") {
    list = db.jobs.filter((j) => j.clientId === req.user.id);
  } else {
    const plumber = db.plumbers.find((p) => p.userId === req.user.id);
    list = plumber ? db.jobs.filter((j) => j.plumberId === plumber.id) : [];
  }
  list = list
    .map(jobView)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json(list);
});

router.get("/:id", authMiddleware, (req, res) => {
  const job = db.jobs.find((j) => j.id === req.params.id);
  if (!job) return res.status(404).json({ error: "Trabajo no encontrado" });
  const { clientId, plumberUserId } = participants(job);
  if (![clientId, plumberUserId].includes(req.user.id)) {
    return res.status(403).json({ error: "Sin acceso a este trabajo" });
  }
  res.json(jobView(job));
});

// Cambiar el estado del trabajo (aceptar, completar, cancelar).
router.patch("/:id/status", authMiddleware, asyncHandler(async (req, res) => {
  const job = db.jobs.find((j) => j.id === req.params.id);
  if (!job) return res.status(404).json({ error: "Trabajo no encontrado" });
  const { clientId, plumberUserId } = participants(job);
  if (![clientId, plumberUserId].includes(req.user.id)) {
    return res.status(403).json({ error: "Sin acceso a este trabajo" });
  }
  const { status } = req.body || {};
  if (!FLOW[job.status] || !FLOW[job.status].includes(status)) {
    return res.status(400).json({ error: `Transición inválida desde '${job.status}'` });
  }
  // Reglas: aceptar, iniciar y finalizar el trabajo son acciones exclusivas del plomero.
  if (PLUMBER_ONLY_STATUS.includes(status) && req.user.id !== plumberUserId) {
    return res.status(403).json({ error: "Solo el plomero puede realizar esta acción" });
  }
  job.status = status;
  if (status === "completed") job.completedAt = new Date().toISOString();
  await saveDB();
  res.json(jobView(job));
}));

// Plomero fija/actualiza el presupuesto acordado.
router.patch("/:id/price", authMiddleware, asyncHandler(async (req, res) => {
  const job = db.jobs.find((j) => j.id === req.params.id);
  if (!job) return res.status(404).json({ error: "Trabajo no encontrado" });
  const { plumberUserId } = participants(job);
  if (req.user.id !== plumberUserId) {
    return res.status(403).json({ error: "Solo el plomero fija el presupuesto" });
  }
  const { agreedPrice } = req.body || {};
  job.agreedPrice = Number(agreedPrice) || 0;
  await saveDB();
  res.json(jobView(job));
}));

export default router;
