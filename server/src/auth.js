import crypto from "crypto";
import jwt from "jsonwebtoken";

export const JWT_SECRET = process.env.JWT_SECRET || "mvp-oficios-secret-dev";
const RESET_TOKEN_TTL_MS = 30 * 60 * 1000; // 30 minutos

export function signToken(user) {
  return jwt.sign(
    { id: user.id, role: user.role, name: user.name },
    JWT_SECRET,
    { expiresIn: "7d" }
  );
}

export function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

// Verifica el JWT de la request y adjunta el payload a req.user.
export function authMiddleware(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: "No autenticado" });
  const payload = verifyToken(token);
  if (!payload) return res.status(401).json({ error: "Token inválido o expirado" });
  req.user = payload;
  next();
}

// Restringe la ruta a uno o más roles. Debe usarse después de authMiddleware.
export function checkRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: "No autenticado" });
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: "No tenés permisos para esta acción" });
    }
    next();
  };
}

// Genera un token de reset de un solo uso. Se guarda el hash, no el token en claro.
export function generateResetToken() {
  const token = crypto.randomBytes(32).toString("hex");
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS).toISOString();
  return { token, tokenHash, expiresAt };
}

export function verifyResetToken(user, token) {
  if (!user?.resetTokenHash || !user?.resetTokenExpiresAt) return false;
  if (new Date(user.resetTokenExpiresAt) < new Date()) return false;
  const tokenHash = crypto.createHash("sha256").update(String(token || "")).digest("hex");
  return tokenHash === user.resetTokenHash;
}
