import { timingSafeEqual } from "node:crypto";
import { correrMantenimiento } from "@/features/mantenimiento/servicio";
import { json } from "@/lib/api";
import { env } from "@/lib/env";

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
  if (!autorizado(request.headers.get("authorization"))) return json({ error: "No autorizado." }, 401);
  const resultado = await correrMantenimiento();
  console.info("[mantenimiento]", resultado);
  return json(resultado);
}
