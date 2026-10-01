import http from "http";
import express from "express";
import cors from "cors";
import { Server } from "socket.io";
import { nanoid } from "nanoid";

import { db, saveDB, loadDB, pingDatabase } from "./db.js";
import { asyncHandler } from "./helpers.js";
import { verifyToken } from "./auth.js";
import { puedeChatear } from "./models/Solicitud.js";
import authRoutes from "./routes/auth.js";
import fleteroRoutes from "./routes/fleteros.js";
import solicitudRoutes from "./routes/solicitudes.js";
import mensajeRoutes from "./routes/mensajes.js";
import resenaRoutes from "./routes/resenas.js";

const PORT = process.env.PORT || 4000;
const MAX_IMAGEN_CHAT = 2 * 1024 * 1024; // data URL comprimida en el cliente
const app = express();

app.use(cors());
// Las fotos (solicitud, inventario, perfil) viajan como data URLs comprimidas.
app.use(express.json({ limit: "20mb" }));

app.get("/api/health", asyncHandler(async (_req, res) => {
  const dbStatus = await pingDatabase();
  res.json({ ok: dbStatus.ok, database: dbStatus.driver, error: dbStatus.error });
}));
app.use("/api/auth", authRoutes);
app.use("/api/fleteros", fleteroRoutes);
app.use("/api/solicitudes", solicitudRoutes);
app.use("/api/mensajes", mensajeRoutes);
app.use("/api/resenas", resenaRoutes);

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" }, maxHttpBufferSize: 4e6 });

// Autenticación de sockets vía JWT.
io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  const payload = token ? verifyToken(token) : null;
  if (!payload) return next(new Error("No autorizado"));
  socket.user = payload;
  next();
});

// Una sala por conversación cliente ↔ fletero dentro de una solicitud.
const sala = (solicitudId, fleteroId) => `chat:${solicitudId}:${fleteroId}`;

io.on("connection", (socket) => {
  socket.on("chat:join", ({ solicitudId, fleteroId } = {}) => {
    if (!puedeChatear(socket.user.id, solicitudId, fleteroId)) return;
    socket.join(sala(solicitudId, fleteroId));
  });

  socket.on("chat:leave", ({ solicitudId, fleteroId } = {}) => {
    socket.leave(sala(solicitudId, fleteroId));
  });

  socket.on("chat:message", async ({ solicitudId, fleteroId, cuerpo, imagenUrl } = {}) => {
    if (!puedeChatear(socket.user.id, solicitudId, fleteroId)) return;
    const texto = String(cuerpo || "").trim();
    const imagen =
      typeof imagenUrl === "string" && imagenUrl.startsWith("data:image/") && imagenUrl.length <= MAX_IMAGEN_CHAT
        ? imagenUrl
        : "";
    if (!texto && !imagen) return;
    const mensaje = {
      id: nanoid(10),
      solicitudId,
      fleteroId,
      remitenteId: socket.user.id,
      remitenteNombre: socket.user.nombre,
      cuerpo: texto,
      imagenUrl: imagen,
      creadoEn: new Date().toISOString()
    };
    db.mensajes.push(mensaje);
    try {
      await saveDB();
    } catch (err) {
      db.mensajes.pop();
      console.error("[chat] No se pudo guardar el mensaje:", err.message);
      return;
    }
    io.to(sala(solicitudId, fleteroId)).emit("chat:message", mensaje);
  });
});

app.use((err, _req, res, _next) => {
  console.error(err);
  if (err.type === "entity.too.large") {
    return res.status(413).json({ error: "Los archivos adjuntos son demasiado pesados" });
  }
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
