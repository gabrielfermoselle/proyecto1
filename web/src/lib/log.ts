import { headers } from "next/headers";

// Logs estructurados: una línea JSON por evento, con el id del request (lo asigna el
// middleware en x-request-id y viaja en la respuesta). Vercel los recolecta por función y se
// pueden filtrar por `evento` o `requestId`. Nunca se registran contraseñas, tokens ni hashes.

export type Nivel = "info" | "warn" | "error";
type Datos = Record<string, unknown>;

export interface Logger {
  info: (evento: string, datos?: Datos) => void;
  warn: (evento: string, datos?: Datos) => void;
  error: (evento: string, datos?: Datos) => void;
}

/** Claves que nunca se escriben (en cualquier nivel de anidamiento). */
const SENSIBLES = /pass(word)?|contrase|clave|secret|token|hash|authorization|cookie|api[-_]?key/i;
const PROFUNDIDAD_MAXIMA = 5;

function serializar(valor: unknown, profundidad = 0): unknown {
  if (valor instanceof Error) {
    return {
      nombre: valor.name,
      mensaje: valor.message,
      ...(valor.stack ? { stack: valor.stack.split("\n").slice(0, 8).join("\n") } : {}),
      ...("code" in valor ? { codigo: (valor as { code: unknown }).code } : {}),
    };
  }
  if (valor instanceof Date) return valor.toISOString();
  if (typeof valor === "bigint") return valor.toString();
  if (valor === null || typeof valor !== "object") return valor;
  if (profundidad >= PROFUNDIDAD_MAXIMA) return "[…]";
  if (Array.isArray(valor)) return valor.slice(0, 50).map((v) => serializar(v, profundidad + 1));
  return Object.fromEntries(
    Object.entries(valor).map(([clave, v]) => [
      clave,
      SENSIBLES.test(clave) ? "[oculto]" : serializar(v, profundidad + 1),
    ]),
  );
}

/** Arma la línea JSON de un evento (separado de la salida para poder testearlo). */
export function lineaDeLog(nivel: Nivel, evento: string, base: Datos, datos: Datos = {}, ahora = new Date()): string {
  return JSON.stringify({
    nivel,
    evento,
    momento: ahora.toISOString(),
    ...(serializar({ ...base, ...datos }) as Datos),
  });
}

const salida: Record<Nivel, (linea: string) => void> = {
  info: (l) => console.log(l),
  warn: (l) => console.warn(l),
  error: (l) => console.error(l),
};

export function crearLogger(base: Datos = {}): Logger {
  const emitir = (nivel: Nivel) => (evento: string, datos?: Datos) => salida[nivel](lineaDeLog(nivel, evento, base, datos));
  return { info: emitir("info"), warn: emitir("warn"), error: emitir("error") };
}

/** Logger sin request (tareas fuera de un request, o cuando no hay headers). */
export const log = crearLogger();

/** El id del request lo pone el middleware; si no pasó por él, el de Vercel. */
export async function idDelRequest(): Promise<string | undefined> {
  try {
    const h = await headers();
    return h.get("x-request-id") ?? h.get("x-vercel-id") ?? undefined;
  } catch {
    return undefined; // fuera de un request (scripts, tests sin contexto)
  }
}

/** Logger con el requestId del request actual. */
export async function logDelRequest(): Promise<Logger> {
  const requestId = await idDelRequest();
  return requestId ? crearLogger({ requestId }) : log;
}
