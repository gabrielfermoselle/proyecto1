import express from "express";
import cors from "cors";

import { loadDB, pingDatabase } from "./db.js";
import { asyncHandler } from "./helpers.js";
import authRoutes from "./routes/auth.js";
import fleteroRoutes from "./routes/fleteros.js";
import solicitudRoutes from "./routes/solicitudes.js";
import mensajeRoutes from "./routes/mensajes.js";
import resenaRoutes from "./routes/resenas.js";

const app = express();

let ready = null;

export function ensureDB() {
  if (!ready) {
    ready = loadDB().catch((err) => {
      ready = null;
      throw err;
    });
  }
  return ready;
}

app.use(cors());
app.use(express.json({ limit: "20mb" }));

app.use((req, res, next) => {
  ensureDB().then(() => next()).catch(next);
});

app.get("/api/health", asyncHandler(async (_req, res) => {
  const dbStatus = await pingDatabase();
  res.json({ ok: dbStatus.ok, database: dbStatus.driver, error: dbStatus.error });
}));
app.use("/api/auth", authRoutes);
app.use("/api/fleteros", fleteroRoutes);
app.use("/api/solicitudes", solicitudRoutes);
app.use("/api/mensajes", mensajeRoutes);
app.use("/api/resenas", resenaRoutes);

app.use((err, _req, res, _next) => {
  console.error(err);
  if (err.type === "entity.too.large") {
    return res.status(413).json({ error: "Los archivos adjuntos son demasiado pesados" });
  }
  const message = process.env.VERCEL && /SUPABASE_/i.test(err.message)
    ? err.message
    : "Error interno del servidor";
  res.status(500).json({ error: message });
});

export default app;
