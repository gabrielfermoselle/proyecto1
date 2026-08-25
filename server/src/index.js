import http from "http";
import express from "express";
import cors from "cors";
import { Server } from "socket.io";
import { nanoid } from "nanoid";

import { db, saveDB, loadDB, pingDatabase } from "./db.js";
import { asyncHandler } from "./helpers.js";
import { verifyToken } from "./auth.js";
import authRoutes from "./routes/auth.js";
import plumberRoutes from "./routes/plumbers.js";
import jobRoutes from "./routes/jobs.js";
import reviewRoutes from "./routes/reviews.js";
import messageRoutes from "./routes/messages.js";

const PORT = process.env.PORT || 4000;
const app = express();

app.use(cors());
app.use(express.json({ limit: "6mb" }));

app.get("/api/health", asyncHandler(async (_req, res) => {
  const dbStatus = await pingDatabase();
  res.json({ ok: dbStatus.ok, database: dbStatus.driver, error: dbStatus.error });
}));
app.use("/api/auth", authRoutes);
app.use("/api/plumbers", plumberRoutes);
app.use("/api/jobs", jobRoutes);
app.use("/api/reviews", reviewRoutes);
app.use("/api/messages", messageRoutes);

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

// Autenticación de sockets vía JWT.
io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  const payload = token ? verifyToken(token) : null;
  if (!payload) return next(new Error("No autorizado"));
  socket.user = payload;
  next();
});

// Comprueba que el usuario pertenezca al trabajo antes de unirlo a la sala.
function canAccessJob(userId, jobId) {
  const job = db.jobs.find((j) => j.id === jobId);
  if (!job) return false;
  const plumber = db.plumbers.find((p) => p.id === job.plumberId);
  const plumberUserId = plumber ? plumber.userId : null;
  return [job.clientId, plumberUserId].includes(userId);
}

io.on("connection", (socket) => {
  socket.on("chat:join", (jobId) => {
    if (!canAccessJob(socket.user.id, jobId)) return;
    socket.join(`job:${jobId}`);
  });

  socket.on("chat:message", async ({ jobId, body }) => {
    if (!canAccessJob(socket.user.id, jobId)) return;
    const text = String(body || "").trim();
    if (!text) return;
    const message = {
      id: nanoid(10),
      jobId,
      senderId: socket.user.id,
      senderName: socket.user.name,
      body: text,
      createdAt: new Date().toISOString()
    };
    db.messages.push(message);
    try {
      await saveDB();
    } catch (err) {
      db.messages.pop();
      console.error("[chat] No se pudo guardar el mensaje:", err.message);
      return;
    }
    io.to(`job:${jobId}`).emit("chat:message", message);
  });
});

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: "Error interno del servidor" });
});

try {
  await loadDB();
  server.listen(PORT, () => {
    console.log(`API + chat en http://localhost:${PORT}`);
  });
} catch (err) {
  console.error("No se pudo inicializar la base de datos:", err.message);
  process.exit(1);
}
