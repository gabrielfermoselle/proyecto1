import { Router } from "express";
import { nanoid } from "nanoid";
import { db, saveDB } from "../db.js";
import { authMiddleware, checkRole } from "../auth.js";

const router = Router();

// Estados válidos y transiciones permitidas.
const FLOW = {
  requested: ["accepted", "cancelled"],
  accepted: ["completed", "cancelled"],
  completed: [],
  cancelled: []
};

function jobView(job) {
  const client = db.users.find((u) => u.id === job.clientId);
  const worker = db.workers.find((w) => w.id === job.workerId);
  const workerUser = worker ? db.users.find((u) => u.id === worker.userId) : null;
  const hasReview = db.reviews.some((r) => r.jobId === job.id);
  return {
    ...job,
    clientName: client ? client.name : "Cliente",
    workerName: workerUser ? workerUser.name : "Trabajador",
    workerUserId: workerUser ? workerUser.id : null,
    reviewed: hasReview
  };
}

// Verifica que el usuario forme parte del trabajo (cliente o trabajador dueño).
function participants(job) {
  const worker = db.workers.find((w) => w.id === job.workerId);
  return { clientId: job.clientId, workerUserId: worker ? worker.userId : null };
}

// Cliente solicita una contratación a un trabajador.
router.post("/", authMiddleware, checkRole("client"), (req, res) => {
  const { workerId, title, description } = req.body || {};
  const worker = db.workers.find((w) => w.id === workerId);
  if (!worker) return res.status(404).json({ error: "Trabajador no encontrado" });
  if (!title) return res.status(400).json({ error: "Falta el título del trabajo" });

  const job = {
    id: nanoid(10),
    clientId: req.user.id,
    workerId,
    title: String(title).trim(),
    description: String(description || "").trim(),
    status: "requested",
    agreedPrice: null,
    createdAt: new Date().toISOString(),
    completedAt: null
  };
  db.jobs.push(job);
  saveDB();
  res.json(jobView(job));
});

// Lista de contrataciones del usuario autenticado (según su rol).
router.get("/", authMiddleware, (req, res) => {
  let list;
  if (req.user.role === "client") {
    list = db.jobs.filter((j) => j.clientId === req.user.id);
  } else {
    const worker = db.workers.find((w) => w.userId === req.user.id);
    list = worker ? db.jobs.filter((j) => j.workerId === worker.id) : [];
  }
  list = list
    .map(jobView)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json(list);
});

router.get("/:id", authMiddleware, (req, res) => {
  const job = db.jobs.find((j) => j.id === req.params.id);
  if (!job) return res.status(404).json({ error: "Trabajo no encontrado" });
  const { clientId, workerUserId } = participants(job);
  if (![clientId, workerUserId].includes(req.user.id)) {
    return res.status(403).json({ error: "Sin acceso a este trabajo" });
  }
  res.json(jobView(job));
});

// Cambiar el estado del trabajo (aceptar, completar, cancelar).
router.patch("/:id/status", authMiddleware, (req, res) => {
  const job = db.jobs.find((j) => j.id === req.params.id);
  if (!job) return res.status(404).json({ error: "Trabajo no encontrado" });
  const { clientId, workerUserId } = participants(job);
  if (![clientId, workerUserId].includes(req.user.id)) {
    return res.status(403).json({ error: "Sin acceso a este trabajo" });
  }
  const { status } = req.body || {};
  if (!FLOW[job.status] || !FLOW[job.status].includes(status)) {
    return res.status(400).json({ error: `Transición inválida desde '${job.status}'` });
  }
  // Reglas: aceptar solo lo hace el trabajador; completar cualquiera de los dos.
  if (status === "accepted" && req.user.id !== workerUserId) {
    return res.status(403).json({ error: "Solo el trabajador puede aceptar" });
  }
  job.status = status;
  if (status === "completed") job.completedAt = new Date().toISOString();
  saveDB();
  res.json(jobView(job));
});

// Trabajador fija/actualiza el presupuesto acordado.
router.patch("/:id/price", authMiddleware, (req, res) => {
  const job = db.jobs.find((j) => j.id === req.params.id);
  if (!job) return res.status(404).json({ error: "Trabajo no encontrado" });
  const { workerUserId } = participants(job);
  if (req.user.id !== workerUserId) {
    return res.status(403).json({ error: "Solo el trabajador fija el presupuesto" });
  }
  const { agreedPrice } = req.body || {};
  job.agreedPrice = Number(agreedPrice) || 0;
  saveDB();
  res.json(jobView(job));
});

export default router;
