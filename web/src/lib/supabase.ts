import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env } from "./env";
import { firmarJwtHs256 } from "./jwt";

// Supabase se usa solo para Realtime y Storage (los datos van por Prisma). Todo es opcional:
// sin configuración, las funciones devuelven null o no hacen nada y la app sigue funcionando.

interface ConfigSupabase {
  url: string;
  anonKey: string;
  serviceRoleKey: string;
  jwtSecret: string;
}

function config(): ConfigSupabase | null {
  const { SUPABASE_URL: url, SUPABASE_ANON_KEY: anonKey, SUPABASE_SERVICE_ROLE_KEY: serviceRoleKey } = env;
  const jwtSecret = env.SUPABASE_JWT_SECRET;
  return url && anonKey && serviceRoleKey && jwtSecret ? { url, anonKey, serviceRoleKey, jwtSecret } : null;
}

export function supabaseHabilitado(): boolean {
  return config() !== null;
}

/** Lo que el navegador necesita para conectarse (la anon key es pública por diseño). */
export function configPublicaSupabase(): { url: string; anonKey: string } | null {
  const c = config();
  return c ? { url: c.url, anonKey: c.anonKey } : null;
}

let admin: SupabaseClient | null = null;

/** Cliente con service_role: solo en el servidor. */
export function supabaseAdmin(): SupabaseClient | null {
  const c = config();
  if (!c) return null;
  admin ??= createClient(c.url, c.serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return admin;
}

export interface Publicacion {
  topic: string;
  event: string;
  payload: Record<string, unknown>;
}

/**
 * Publica avisos en canales privados de Realtime por la API REST (funciona en serverless).
 * Un fallo no rompe la operación: la base ya tiene los datos y los clientes los traen al
 * reconectar o en la próxima consulta.
 */
export async function publicar(publicaciones: Publicacion[]): Promise<void> {
  const c = config();
  if (!c || publicaciones.length === 0) return;
  try {
    const respuesta = await fetch(`${c.url}/realtime/v1/api/broadcast`, {
      method: "POST",
      headers: {
        apikey: c.serviceRoleKey,
        Authorization: `Bearer ${c.serviceRoleKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ messages: publicaciones.map((p) => ({ ...p, private: true })) }),
    });
    if (!respuesta.ok) console.warn("[realtime] no se pudo publicar", respuesta.status);
  } catch (error) {
    console.warn("[realtime] no se pudo publicar", error);
  }
}

export const DURACION_TOKEN_REALTIME_S = 15 * 60;

/**
 * Token de Realtime para un usuario: válido 15 minutos y solo para los canales que el servidor
 * ya verificó que le corresponden (la política RLS de realtime.messages lee el claim "topics").
 */
export function firmarTokenRealtime(
  userId: string,
  topics: string[],
): { token: string; expiraEn: number } | null {
  const c = config();
  if (!c) return null;
  const ahora = Math.floor(Date.now() / 1000);
  const expiraEn = ahora + DURACION_TOKEN_REALTIME_S;
  const token = firmarJwtHs256(
    { sub: userId, role: "authenticated", aud: "authenticated", iat: ahora, exp: expiraEn, topics },
    c.jwtSecret,
  );
  return { token, expiraEn };
}
