import "server-only";
import { createHash, randomBytes } from "node:crypto";
import type { Correo } from "@/lib/correo";

// Recuperación de contraseña: el token viaja una sola vez (en el email) y en la base queda solo
// su hash SHA-256. Es aleatorio de 256 bits, así que no hace falta un hash lento como bcrypt.

/** El link vale 30 minutos. */
export const VIGENCIA_TOKEN_MS = 30 * 60 * 1000;

export function generarToken(): { token: string; tokenHash: string } {
  const token = randomBytes(32).toString("base64url");
  return { token, tokenHash: hashToken(token) };
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

const escaparHtml = (texto: string) =>
  texto.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export function correoRecuperacion(p: { para: string; nombre: string; link: string }): Correo {
  const asunto = "Cambiá tu contraseña de Fletes Tucumán";
  const texto = [
    `Hola, ${p.nombre}.`,
    "",
    "Pediste cambiar tu contraseña. Entrá a este link para elegir una nueva (vale 30 minutos y se usa una sola vez):",
    p.link,
    "",
    "Si no fuiste vos, ignorá este email: tu contraseña sigue igual.",
  ].join("\n");
  const html = `<p>Hola, ${escaparHtml(p.nombre)}.</p>
<p>Pediste cambiar tu contraseña. Tocá el botón para elegir una nueva. El link vale 30 minutos y se usa una sola vez.</p>
<p><a href="${escaparHtml(p.link)}" style="display:inline-block;padding:12px 20px;background:#1d4ed8;color:#fff;border-radius:8px;text-decoration:none;font-weight:600">Elegir una contraseña nueva</a></p>
<p style="color:#555">Si no fuiste vos, ignorá este email: tu contraseña sigue igual.</p>`;
  return { para: p.para, asunto, texto, html };
}
