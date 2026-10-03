import http from "http";
import { Server } from "socket.io";
import { nanoid } from "nanoid";

import app, { ensureDB } from "./app.js";
import { db, saveDB } from "./db.js";
import { verifyToken } from "./auth.js";
import { puedeChatear } from "./models/Solicitud.js";

const PORT = process.env.PORT || 4000;
const MAX_IMAGEN_CHAT = 2 * 1024 * 1024; // data URL comprimida en el cliente

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

try {
  await ensureDB();
  server.listen(PORT, () => {
    console.log(`API + chat en http://localhost:${PORT}`);
  });
} catch (err) {
  console.error("No se pudo inicializar la base de datos:", err.message);
  process.exit(1);
}
