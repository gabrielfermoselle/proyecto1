import type { Rol } from "@prisma/client";

/** Página del flete de cada parte: la gestión del fletero o el seguimiento del cliente. */
export const hrefFlete = (rol: Extract<Rol, "CLIENTE" | "FLETERO">, fleteId: string) =>
  `${rol === "CLIENTE" ? "/cliente" : "/fletero"}/fletes/${fleteId}`;

export const hrefComprobante = (fleteId: string) => `/api/fletes/${fleteId}/comprobante`;

/** Canal de Realtime con los cambios del flete (etapa, inventario). */
export const topicFlete = (fleteId: string) => `flete:${fleteId}`;
