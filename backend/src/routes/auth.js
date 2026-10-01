import { Router } from "express";
import { db, saveDB } from "../db.js";
import { asyncHandler, fleteroByUsuario } from "../helpers.js";
import { signToken, authMiddleware, generateResetToken, verifyResetToken } from "../auth.js";
import {
  findByCorreo,
  createUsuario,
  verifyContrasena,
  setContrasena,
  toPublic
} from "../models/Usuario.js";
import { createFletero } from "../models/Fletero.js";
import { ROLES, TIPOS_VEHICULO } from "../constants.js";

const router = Router();

router.post("/register", asyncHandler(async (req, res) => {
  const { nombre, correo, contrasena, rol, telefono, tipoVehiculo, radioTrabajoKm } = req.body || {};
  if (!nombre || !correo || !contrasena || !rol) {
    return res.status(400).json({ error: "Faltan campos obligatorios" });
  }
  if (!ROLES.includes(rol)) {
    return res.status(400).json({ error: "Rol inválido" });
  }
  if (rol === "fletero" && !TIPOS_VEHICULO.includes(tipoVehiculo)) {
    return res.status(400).json({ error: "Indicá el tipo de vehículo" });
  }
  if (findByCorreo(correo)) {
    return res.status(409).json({ error: "El email ya está registrado" });
  }

  const usuario = await createUsuario({ nombre, correo, contrasena, rol, telefono });

  // Un fletero arranca con su perfil de vehículo mínimo; lo completa después.
  if (rol === "fletero") {
    await createFletero({ usuarioId: usuario.id, tipoVehiculo, radioTrabajoKm });
  }

  res.json({ token: signToken(usuario), usuario: toPublic(usuario) });
}));

router.post("/login", (req, res) => {
  const { correo, contrasena } = req.body || {};
  const usuario = findByCorreo(correo);
  if (!usuario || !verifyContrasena(usuario, contrasena)) {
    return res.status(401).json({ error: "Credenciales incorrectas" });
  }
  res.json({ token: signToken(usuario), usuario: toPublic(usuario) });
});

router.get("/me", authMiddleware, (req, res) => {
  const usuario = db.usuarios.find((u) => u.id === req.user.id);
  if (!usuario) return res.status(404).json({ error: "Usuario no encontrado" });
  const fletero = fleteroByUsuario(usuario.id);
  res.json({ usuario: toPublic(usuario), fleteroId: fletero ? fletero.id : null });
});

router.put("/me", authMiddleware, asyncHandler(async (req, res) => {
  const { nombre } = req.body || {};
  if (!String(nombre || "").trim()) {
    return res.status(400).json({ error: "El nombre es obligatorio" });
  }
  const usuario = db.usuarios.find((u) => u.id === req.user.id);
  if (!usuario) return res.status(404).json({ error: "Usuario no encontrado" });
  usuario.nombre = String(nombre).trim();
  await saveDB();
  res.json({ usuario: toPublic(usuario) });
}));

// Genera un token de reset de un solo uso. Sin servicio de email configurado,
// el token se devuelve en la respuesta (modo dev) en vez de enviarse.
router.post("/forgot-password", asyncHandler(async (req, res) => {
  const usuario = findByCorreo(req.body?.correo);
  // Respuesta genérica: no revelamos si el email existe o no.
  if (!usuario) return res.json({ ok: true });

  const { token, tokenHash, expiresAt } = generateResetToken();
  usuario.hashTokenReset = tokenHash;
  usuario.tokenResetExpiraEn = expiresAt;
  await saveDB();

  console.log(`[reset-password] token para ${usuario.correo}: ${token}`);
  res.json({ ok: true, devResetToken: token });
}));

router.post("/reset-password", asyncHandler(async (req, res) => {
  const { correo, token, contrasena } = req.body || {};
  if (!correo || !token || !contrasena) {
    return res.status(400).json({ error: "Faltan campos obligatorios" });
  }
  const usuario = findByCorreo(correo);
  if (!usuario || !verifyResetToken(usuario, token)) {
    return res.status(400).json({ error: "Token inválido o expirado" });
  }
  delete usuario.hashTokenReset;
  delete usuario.tokenResetExpiraEn;
  await setContrasena(usuario, contrasena);
  res.json({ ok: true });
}));

export default router;
