import "server-only";
import { appendFile } from "node:fs/promises";
import { env } from "./env";
import { log } from "./log";

// Envío de emails. Con RESEND_API_KEY se usa la API HTTP de Resend (funciona en serverless,
// sin SDK). Sin clave: en desarrollo el email se muestra en la consola; con CORREO_ARCHIVO se
// agrega a un archivo (lo leen los e2e); en producción solo se registra que no se envió.

export interface Correo {
  para: string;
  asunto: string;
  texto: string;
  html: string;
}

/** Remitente de prueba de Resend: sin dominio verificado solo entrega a la cuenta dueña. */
const REMITENTE_PRUEBA = "Fletes Tucumán <onboarding@resend.dev>";

export function correoConfigurado(): boolean {
  return Boolean(env.RESEND_API_KEY);
}

/** URL pública de la app para los links de los emails. */
export function urlPublicaApp(): string {
  if (env.NEXTAUTH_URL) return env.NEXTAUTH_URL.replace(/\/$/, "");
  if (env.VERCEL_URL) return `https://${env.VERCEL_URL}`;
  return "http://localhost:3000";
}

/** Devuelve true si el email salió (o quedó registrado en modo desarrollo). Nunca tira. */
export async function enviarCorreo(correo: Correo): Promise<boolean> {
  if (env.RESEND_API_KEY) {
    try {
      const respuesta = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: env.CORREO_REMITENTE ?? REMITENTE_PRUEBA,
          to: [correo.para],
          subject: correo.asunto,
          text: correo.texto,
          html: correo.html,
        }),
      });
      if (respuesta.ok) {
        log.info("correo.enviado", { asunto: correo.asunto });
        return true;
      }
      log.error("correo.rechazado", { estado: respuesta.status, detalle: (await respuesta.text()).slice(0, 300) });
    } catch (error) {
      log.error("correo.error", { error });
    }
    return false;
  }

  if (env.CORREO_ARCHIVO) {
    await appendFile(env.CORREO_ARCHIVO, `${JSON.stringify({ ...correo, enviadoEn: new Date() })}\n`, "utf8");
    return true;
  }
  if (env.NODE_ENV !== "production") {
    // Modo desarrollo: el contenido (con el link) en la consola del servidor.
    console.info(`\n[correo] (sin RESEND_API_KEY) Para: ${correo.para}\nAsunto: ${correo.asunto}\n${correo.texto}\n`);
    return true;
  }
  // En producción el link no se escribe en los logs: quien los lea podría usarlo.
  log.warn("correo.sin_configurar", { asunto: correo.asunto });
  return false;
}
