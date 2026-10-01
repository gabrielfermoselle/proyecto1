import { createHash } from "node:crypto";

/**
 * Firma de Cloudinary para subidas firmadas: SHA-1 de los parámetros ordenados
 * alfabéticamente ("clave=valor" unidos con "&") seguidos del API secret.
 * No se firman file, cloud_name, resource_type ni api_key.
 */
export function firmarParametros(parametros: Record<string, string | number>, apiSecret: string): string {
  const cadena = Object.entries(parametros)
    .filter(
      ([clave, valor]) => valor !== "" && !["file", "cloud_name", "resource_type", "api_key"].includes(clave),
    )
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([clave, valor]) => `${clave}=${valor}`)
    .join("&");
  return createHash("sha1")
    .update(cadena + apiSecret)
    .digest("hex");
}
