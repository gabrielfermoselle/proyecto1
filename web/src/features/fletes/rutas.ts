import type { Rol } from "@prisma/client";

type RolPedido = Extract<Rol, "CLIENTE" | "FLETERO">;

/**
 * Página del pedido de cada parte, por el id de la solicitud: antes de aceptar muestra los
 * presupuestos (cliente) o el formulario para presupuestar (fletero); después, el flete.
 */
export const hrefPedido = (rol: RolPedido, solicitudId: string) =>
  `${rol === "CLIENTE" ? "/cliente" : "/fletero"}/pedido/${solicitudId}`;

/** Patrón de la página del pedido, para `revalidatePath(…, "page")`. */
export const patronPedido = (rol: RolPedido) => `${rol === "CLIENTE" ? "/cliente" : "/fletero"}/pedido/[id]`;

export const hrefCalificar = (solicitudId: string) => `/cliente/pedido/${solicitudId}/calificar`;

export const hrefComprobante = (fleteId: string) => `/api/fletes/${fleteId}/comprobante`;

/** Canal de Realtime con los cambios del flete (etapa, inventario). */
export const topicFlete = (fleteId: string) => `flete:${fleteId}`;
