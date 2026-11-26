// Del lado del navegador: comprime la foto y se la pasa al servidor, que la guarda en Supabase
// Storage con la service_role (así no hace falta exponer ninguna clave en el navegador).

import { subirImagenAlmacen } from "./actions";
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

export interface ImagenSubida {
  ruta: string;
  ancho: number;
  alto: number;
}

/** Codifica el blob a base64 sin reventar la pila con archivos grandes. */
async function blobABase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binario = "";
  const tramo = 0x8000;
  for (let i = 0; i < bytes.length; i += tramo) {
    binario += String.fromCharCode(...bytes.subarray(i, i + tramo));
  }
  return btoa(binario);
}

export async function subirImagen(imagen: ImagenComprimida, subida: SubidaPreparada): Promise<ImagenSubida> {
  const dataBase64 = await blobABase64(imagen.blob);
  const resultado = await subirImagenAlmacen({ bucket: subida.bucket, ruta: subida.ruta, dataBase64 });
  if (!resultado.ok) throw new Error(resultado.error);
  return { ruta: subida.ruta, ancho: imagen.ancho, alto: imagen.alto };
}
