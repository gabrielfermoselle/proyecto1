import "server-only";
import { env } from "@/lib/env";
import { firmarParametros } from "./firma";

// Subidas directas del navegador a Cloudinary, firmadas por el servidor: el binario nunca pasa
// por nuestra app y solo se aceptan archivos de nuestra cuenta y de la carpeta autorizada.

interface ConfigCloudinary {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
}

function config(): ConfigCloudinary | null {
  const {
    CLOUDINARY_CLOUD_NAME: cloudName,
    CLOUDINARY_API_KEY: apiKey,
    CLOUDINARY_API_SECRET: apiSecret,
  } = env;
  return cloudName && apiKey && apiSecret ? { cloudName, apiKey, apiSecret } : null;
}

export function fotosHabilitadas(): boolean {
  return config() !== null;
}

export interface SubidaFirmada {
  url: string;
  campos: Record<string, string>;
}

/** Parámetros para que el navegador suba un archivo a `carpeta`. Vale 1 hora (límite de Cloudinary). */
export function firmarSubida(carpeta: string): SubidaFirmada | null {
  const c = config();
  if (!c) return null;
  const timestamp = Math.floor(Date.now() / 1000);
  const firmados = { folder: carpeta, timestamp };
  return {
    url: `https://api.cloudinary.com/v1_1/${c.cloudName}/image/upload`,
    campos: {
      folder: carpeta,
      timestamp: String(timestamp),
      api_key: c.apiKey,
      signature: firmarParametros(firmados, c.apiSecret),
    },
  };
}

/** La URL es una imagen de nuestra cuenta y el archivo está dentro de la carpeta esperada. */
export function esImagenPropia(url: string, publicId: string, carpeta: string): boolean {
  const c = config();
  if (!c) return false;
  return (
    url.startsWith(`https://res.cloudinary.com/${c.cloudName}/image/upload/`) &&
    publicId.startsWith(`${carpeta}/`)
  );
}

/** Borra la imagen en Cloudinary. Si falla, solo se registra: la fila ya se borró de la base. */
export async function eliminarImagen(publicId: string): Promise<void> {
  const c = config();
  if (!c) return;
  const timestamp = Math.floor(Date.now() / 1000);
  const cuerpo = new URLSearchParams({
    public_id: publicId,
    timestamp: String(timestamp),
    api_key: c.apiKey,
    signature: firmarParametros({ public_id: publicId, timestamp }, c.apiSecret),
  });
  try {
    const respuesta = await fetch(`https://api.cloudinary.com/v1_1/${c.cloudName}/image/destroy`, {
      method: "POST",
      body: cuerpo,
    });
    if (!respuesta.ok) console.warn("[cloudinary] no se pudo borrar", publicId, respuesta.status);
  } catch (error) {
    console.warn("[cloudinary] no se pudo borrar", publicId, error);
  }
}
