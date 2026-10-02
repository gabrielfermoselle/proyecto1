import "server-only";
import { randomUUID } from "node:crypto";
import { supabaseAdmin, supabaseHabilitado } from "@/lib/supabase";
import { env } from "@/lib/env";

// Fotos en Supabase Storage. El navegador sube directo con una URL firmada por el servidor;
// el binario nunca pasa por nuestra app.
//  - fotos-publicas: vehículos (se ven en el perfil público).
//  - fotos-privadas: chat, solicitudes e ítems. Se sirven con URLs firmadas de corta duración.

export const BUCKET_PUBLICO = "fotos-publicas";
export const BUCKET_PRIVADO = "fotos-privadas";
export type Bucket = typeof BUCKET_PUBLICO | typeof BUCKET_PRIVADO;

/** Las URLs firmadas duran 6 h: alcanza para una sesión de chat larga. */
const DURACION_URL_FIRMADA_S = 6 * 60 * 60;

export const fotosHabilitadas = supabaseHabilitado;

export interface SubidaPreparada {
  bucket: Bucket;
  ruta: string;
  token: string;
}

/** Reserva una ruta nueva dentro de `carpeta` y devuelve el token para subir ahí. */
export async function prepararSubida(bucket: Bucket, carpeta: string): Promise<SubidaPreparada | null> {
  const admin = supabaseAdmin();
  if (!admin) return null;
  const ruta = `${carpeta}/${randomUUID()}.jpg`;
  const { data, error } = await admin.storage.from(bucket).createSignedUploadUrl(ruta);
  if (error) throw error;
  return { bucket, ruta: data.path, token: data.token };
}

/**
 * Valida una ruta que vuelve del navegador: dentro de la carpeta autorizada, sin "..",
 * con el formato que generamos nosotros, y que el archivo exista de verdad.
 */
export async function rutaSubidaValida(bucket: Bucket, ruta: string, carpeta: string): Promise<boolean> {
  const formatoOk =
    ruta.startsWith(`${carpeta}/`) && !ruta.includes("..") && /^[\w/-]+\/[0-9a-f-]{36}\.jpg$/.test(ruta);
  if (!formatoOk) return false;
  const admin = supabaseAdmin();
  if (!admin) return false;
  const { data } = await admin.storage.from(bucket).exists(ruta);
  return data;
}

export function urlPublica(ruta: string): string | null {
  return env.SUPABASE_URL ? `${env.SUPABASE_URL}/storage/v1/object/public/${BUCKET_PUBLICO}/${ruta}` : null;
}

/** URLs firmadas para fotos privadas, en una sola llamada. Las que fallan quedan afuera. */
export async function urlsFirmadas(rutas: string[]): Promise<Map<string, string>> {
  const admin = supabaseAdmin();
  const urls = new Map<string, string>();
  if (!admin || rutas.length === 0) return urls;
  const { data, error } = await admin.storage
    .from(BUCKET_PRIVADO)
    .createSignedUrls(rutas, DURACION_URL_FIRMADA_S);
  if (error) {
    console.warn("[storage] no se pudieron firmar URLs", error.message);
    return urls;
  }
  for (const fila of data) if (fila.path && fila.signedUrl) urls.set(fila.path, fila.signedUrl);
  return urls;
}

/** Borra archivos. Si falla, solo se registra: la fila ya se borró de la base. */
export async function eliminarArchivos(bucket: Bucket, rutas: string[]): Promise<void> {
  const admin = supabaseAdmin();
  if (!admin || rutas.length === 0) return;
  const { error } = await admin.storage.from(bucket).remove(rutas);
  if (error) console.warn("[storage] no se pudo borrar", rutas, error.message);
}
