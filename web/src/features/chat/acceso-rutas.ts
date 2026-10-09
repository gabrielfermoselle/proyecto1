import type { RolChat } from "./dto";

/**
 * Chat de un pedido. El fletero tiene una sola conversación por pedido; el cliente, una por cada
 * fletero que le presupuestó. Sin dependencias de servidor: lo usan también los componentes.
 */
export const hrefConversacion = (rol: RolChat, solicitudId: string, fleteroId: string) =>
  rol === "FLETERO" ? `/chat/${solicitudId}` : `/chat/${solicitudId}/${fleteroId}`;
