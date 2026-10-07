// Id de request: lo usa el middleware (Edge), así que no depende de Node ni de Next.

export const HEADER_REQUEST_ID = "x-request-id";

/** Un id que llega del cliente se acepta solo con este formato: nada que ensucie los logs. */
const FORMATO_VALIDO = /^[A-Za-z0-9_-]{8,64}$/;

/** Reusa el id entrante si es válido (un proxy adelante puede haberlo puesto); si no, uno nuevo. */
export function resolverRequestId(entrante: string | null): string {
  return entrante && FORMATO_VALIDO.test(entrante) ? entrante : crypto.randomUUID();
}
