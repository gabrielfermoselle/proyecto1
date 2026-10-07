import { timingSafeEqual } from "node:crypto";
import { correrMantenimiento } from "@/features/mantenimiento/servicio";
import { json } from "@/lib/api";
import { env } from "@/lib/env";
import { logDelRequest } from "@/lib/log";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Compara en tiempo constante: no revela cuántos caracteres del secreto coinciden. */
function autorizado(header: string | null): boolean {
  const secreto = env.CRON_SECRET;
  if (!secreto || !header) return false;
  const esperado = Buffer.from(`Bearer ${secreto}`);
  const recibido = Buffer.from(header);
  return esperado.length === recibido.length && timingSafeEqual(esperado, recibido);
}

/** Mantenimiento diario. Lo dispara Vercel Cron (ver vercel.json) con `Authorization: Bearer <CRON_SECRET>`. */
export async function GET(request: Request) {
  const logger = await logDelRequest();
  if (!autorizado(request.headers.get("authorization"))) {
    logger.warn("cron.no_autorizado");
    return json({ error: "No autorizado." }, 401);
  }
  const inicio = Date.now();
  const resultado = await correrMantenimiento();
  logger.info("cron.mantenimiento", { ...resultado, duracionMs: Date.now() - inicio });
  return json(resultado);
}
