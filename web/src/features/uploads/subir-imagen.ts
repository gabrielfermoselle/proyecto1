// Del lado del navegador: comprime la foto y la sube directo a Supabase Storage con el token
// que firmó el servidor.

import type { SubidaPreparada } from "./storage";

const LADO_MAXIMO_PX = 1600;
const CALIDAD_JPEG = 0.82;

export interface ImagenComprimida {
  blob: Blob;
  ancho: number;
  alto: number;
}

/** Reduce la foto a 1600 px de lado y la recomprime: una foto de celular pasa de ~4 MB a ~300 KB. */
export async function comprimirImagen(archivo: File): Promise<ImagenComprimida> {
  const bitmap = await createImageBitmap(archivo).catch(() => {
    throw new Error("No pudimos leer la imagen. Probá con una foto en JPG o PNG.");
  });
  const escala = Math.min(1, LADO_MAXIMO_PX / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * escala);
  canvas.height = Math.round(bitmap.height * escala);
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("No pudimos procesar la imagen."))),
      "image/jpeg",
      CALIDAD_JPEG,
    ),
  );
  return { blob, ancho: canvas.width, alto: canvas.height };
}

export interface ConfigStorageCliente {
  url: string;
  anonKey: string;
}

export interface ImagenSubida {
  ruta: string;
  ancho: number;
  alto: number;
}

export async function subirImagen(
  imagen: ImagenComprimida,
  subida: SubidaPreparada,
  config: ConfigStorageCliente,
): Promise<ImagenSubida> {
  // Se carga recién al subir: no suma peso a las páginas que no suben fotos.
  const { createClient } = await import("@supabase/supabase-js");
  const supabase = createClient(config.url, config.anonKey, { auth: { persistSession: false } });
  const { error } = await supabase.storage
    .from(subida.bucket)
    .uploadToSignedUrl(subida.ruta, subida.token, imagen.blob, { contentType: "image/jpeg" });
  if (error) throw new Error("No se pudo subir la foto. Probá de nuevo.");
  return { ruta: subida.ruta, ancho: imagen.ancho, alto: imagen.alto };
}
