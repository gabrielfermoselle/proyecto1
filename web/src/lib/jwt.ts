import { createHmac } from "node:crypto";

// JWT HS256 mínimo para los tokens de Supabase Realtime. No hace falta verificar: los emite
// nuestro servidor y los valida Supabase con el mismo secreto.

const base64url = (valor: string | Buffer) => Buffer.from(valor).toString("base64url");

export function firmarJwtHs256(payload: Record<string, unknown>, secreto: string): string {
  const encabezado = base64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const cuerpo = base64url(JSON.stringify(payload));
  const firma = createHmac("sha256", secreto).update(`${encabezado}.${cuerpo}`).digest("base64url");
  return `${encabezado}.${cuerpo}.${firma}`;
}
