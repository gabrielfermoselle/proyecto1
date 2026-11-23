import "server-only";
import { randomUUID } from "node:crypto";
import { db, fallar } from "@/lib/db";
import { env } from "@/lib/env";
import { log } from "@/lib/log";
import { supabaseAdmin } from "@/lib/supabase";

// Fotos en Supabase Storage. El navegador comprime la imagen y el servidor la sube con la
// service_role: así alcanza con SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (la anon key y el JWT
// solo hacen falta para Realtime en vivo).
//  - fotos-publicas: vehículos (se ven en el perfil público).
//  - fotos-privadas: chat, solicitudes e ítems. Se sirven con URLs firmadas de corta duración.
//  - FotosCosas: miniaturas fijas de los muebles típicos (`domain/muebles.ts`). Se suben a mano.

export const BUCKET_PUBLICO = "fotos-publicas";
export const BUCKET_PRIVADO = "fotos-privadas";
export type Bucket = typeof BUCKET_PUBLICO | typeof BUCKET_PRIVADO;

/** Las URLs firmadas duran 6 h: alcanza para una sesión de chat larga. */
const DURACION_URL_FIRMADA_S = 6 * 60 * 60;

/** Las fotos quedan habilitadas con solo configurar el acceso de servidor a Supabase. */
export function fotosHabilitadas(): boolean {
  return supabaseAdmin() !== null;
}

/** Igual que el bucket, Storage solo acepta JPEG de hasta 5 MB. */
export const TAMANO_MAXIMO_FOTO_BYTES = 5 * 1024 * 1024;

export interface SubidaPreparada {
  bucket: Bucket;
  ruta: string;
}

/**
 * Reserva una ruta nueva dentro de `carpeta`. La ruta queda como pendiente: si nunca se adjunta
 * a una foto, el mantenimiento diario borra el archivo.
 */
export async function prepararSubida(bucket: Bucket, carpeta: string): Promise<SubidaPreparada | null> {
  if (!supabaseAdmin()) return null;
  const ruta = `${carpeta}/${randomUUID()}.jpg`;
  const { error } = await db().from("subidas_pendientes").insert({ ruta, bucket });
  fallar(error);
  return { bucket, ruta };
}

/** Confirma que una ruta fue reservada por `prepararSubida` (no se puede escribir en cualquier lado). */
export async function rutaReservada(bucket: Bucket, ruta: string): Promise<boolean> {
  const { data, error } = await db()
    .from("subidas_pendientes")
    .select("ruta")
    .eq("bucket", bucket)
    .eq("ruta", ruta)
    .maybeSingle();
  fallar(error);
  return Boolean(data);
}

/** Sube una imagen JPEG a una ruta ya reservada. Solo en el servidor, con la service_role. */
export async function guardarImagen(bucket: Bucket, ruta: string, bytes: Uint8Array): Promise<void> {
  const admin = supabaseAdmin();
  if (!admin) throw new Error("Storage no configurado");
  if (bytes.byteLength === 0 || bytes.byteLength > TAMANO_MAXIMO_FOTO_BYTES) {
    throw new Error("Imagen fuera del tamaño permitido");
  }
  const { error } = await admin.storage
    .from(bucket)
    .upload(ruta, bytes, { contentType: "image/jpeg", upsert: true });
  if (error) throw error;
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

/** Base pública de las miniaturas de muebles; null si Supabase no está configurado. */
export function urlBaseFotosCosas(): string | null {
  return env.SUPABASE_URL ? `${env.SUPABASE_URL}/storage/v1/object/public/FotosCosas` : null;
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
    log.warn("storage.firmar_fallo", { error });
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
  if (error) log.warn("storage.borrar_fallo", { bucket, cantidad: rutas.length, error });
}
