// Paginación por cursor (createdAt, id): estable aunque lleguen mensajes nuevos. Usa Buffer:
// solo para el servidor (route handlers y queries).

export interface Cursor {
  createdAt: Date;
  id: string;
}

export function codificarCursor({ createdAt, id }: Cursor): string {
  return Buffer.from(`${createdAt.toISOString()}|${id}`, "utf8").toString("base64url");
}

/** Devuelve null si el cursor es inválido o fue manipulado. */
export function decodificarCursor(valor: string | null | undefined): Cursor | null {
  if (!valor || valor.length > 200) return null;
  const [iso, id, ...resto] = Buffer.from(valor, "base64url").toString("utf8").split("|");
  if (!iso || !id || resto.length > 0 || !/^[a-z0-9]{1,40}$/i.test(id)) return null;
  const createdAt = new Date(iso);
  return Number.isNaN(createdAt.getTime()) ? null : { createdAt, id };
}
