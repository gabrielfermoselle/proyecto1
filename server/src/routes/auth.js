import { Router } from "express";
import { db, saveDB } from "../db.js";
import {
  signToken,
  authMiddleware,
  generateResetToken,
  verifyResetToken
} from "../auth.js";
import {
  ROLES,
  findByEmail,
  createUser,
  verifyPassword,
  setPassword,
  toPublic
} from "../models/User.js";
import { createPlumber } from "../models/Plumber.js";

const router = Router();

router.post("/register", (req, res) => {
  const { name, email, password, role, phone, specialty, coverageKm } = req.body || {};
  if (!name || !email || !password || !role) {
    return res.status(400).json({ error: "Faltan campos obligatorios" });
  }
  if (!ROLES.includes(role)) {
    return res.status(400).json({ error: "Rol inválido" });
  }
  if (role === "plomero" && !String(specialty || "").trim()) {
    return res.status(400).json({ error: "La especialidad es obligatoria para plomeros" });
  }
  if (findByEmail(email)) {
    return res.status(409).json({ error: "El email ya está registrado" });
  }

  const user = createUser({ name, email, password, role, phone });

  // Si es plomero, creamos su perfil de plomero vacío por defecto.
  if (role === "plomero") {
    const parsedRadius = Number(coverageKm);
    createPlumber({
      userId: user.id,
      especialidad: String(specialty).trim(),
      descripcion: "",
      radioTrabajoKm: Number.isFinite(parsedRadius) && parsedRadius > 0 ? parsedRadius : 10,
      latitud: null,
      longitud: null,
      fotoUrl: ""
    });
  }

  const token = signToken(user);
  res.json({ token, user: toPublic(user) });
});

router.post("/login", (req, res) => {
  const { email, password } = req.body || {};
  const user = findByEmail(email);
  if (!user || !verifyPassword(user, password)) {
    return res.status(401).json({ error: "Credenciales incorrectas" });
  }
  const token = signToken(user);
  res.json({ token, user: toPublic(user) });
});

router.get("/me", authMiddleware, (req, res) => {
  const user = db.users.find((u) => u.id === req.user.id);
  if (!user) return res.status(404).json({ error: "Usuario no encontrado" });
  const plumber = db.plumbers.find((p) => p.userId === user.id) || null;
  res.json({
    user: toPublic(user),
    plumberId: plumber ? plumber.id : null
  });
});

// Genera un token de reset de un solo uso. Por no tener un servicio de email
// configurado, el token se devuelve en la respuesta (modo dev) en vez de enviarse.
router.post("/forgot-password", (req, res) => {
  const { email } = req.body || {};
  const user = findByEmail(email);
  // Respuesta genérica: no revelamos si el email existe o no.
  if (!user) return res.json({ ok: true });

  const { token, tokenHash, expiresAt } = generateResetToken();
  user.resetTokenHash = tokenHash;
  user.resetTokenExpiresAt = expiresAt;
  saveDB();

  console.log(`[reset-password] token para ${user.email}: ${token}`);
  res.json({ ok: true, devResetToken: token });
});

router.post("/reset-password", (req, res) => {
  const { email, token, password } = req.body || {};
  if (!email || !token || !password) {
    return res.status(400).json({ error: "Faltan campos obligatorios" });
  }
  const user = findByEmail(email);
  if (!user || !verifyResetToken(user, token)) {
    return res.status(400).json({ error: "Token inválido o expirado" });
  }

  setPassword(user, password);
  delete user.resetTokenHash;
  delete user.resetTokenExpiresAt;
  saveDB();

  res.json({ ok: true });
});

export default router;
