// Del lado del navegador: comprime la foto y la sube directo a Cloudinary con los
// parámetros firmados por el servidor.

import type { SubidaFirmada } from "./cloudinary";

const LADO_MAXIMO_PX = 1600;
const CALIDAD_JPEG = 0.82;

/** Reduce la foto a 1600 px de lado y la recomprime: una foto de celular pasa de ~4 MB a ~300 KB. */
export async function comprimirImagen(archivo: File): Promise<Blob> {
  const bitmap = await createImageBitmap(archivo).catch(() => {
    throw new Error("No pudimos leer la imagen. Probá con una foto en JPG o PNG.");
  });
  const escala = Math.min(1, LADO_MAXIMO_PX / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * escala);
  canvas.height = Math.round(bitmap.height * escala);
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("No pudimos procesar la imagen."))),
      "image/jpeg",
      CALIDAD_JPEG,
    ),
  );
}

export interface ImagenSubida {
  url: string;
  publicId: string;
  ancho: number;
  alto: number;
}

export async function subirImagen(archivo: File, subida: SubidaFirmada): Promise<ImagenSubida> {
  const datos = new FormData();
  datos.append("file", await comprimirImagen(archivo), "foto.jpg");
  for (const [clave, valor] of Object.entries(subida.campos)) datos.append(clave, valor);

  const respuesta = await fetch(subida.url, { method: "POST", body: datos });
  if (!respuesta.ok) throw new Error("No se pudo subir la foto. Probá de nuevo.");
  const json = (await respuesta.json()) as {
    secure_url: string;
    public_id: string;
    width: number;
    height: number;
  };
  return { url: json.secure_url, publicId: json.public_id, ancho: json.width, alto: json.height };
}
