import "server-only";
import { ActionError } from "./action";
import { consultaConsumir, consultaLimpiar, inicioVentana } from "./limite-tasa-sql";
import { prisma } from "./prisma";

export interface Limite {
  clave: string;
  maximo: number;
  ventanaSegundos: number;
  mensaje: string;
}

const MUY_RAPIDO = "Estás enviando muy rápido. Esperá un momento y probá de nuevo.";

export const LIMITES = {
  mensajesPorConversacion: (userId: string, conversacionId: string): Limite => ({
    clave: `chat:msg:${userId}:${conversacionId}`,
    maximo: 20,
    ventanaSegundos: 60,
    mensaje: MUY_RAPIDO,
  }),
  mensajesPorUsuario: (userId: string): Limite => ({
    clave: `chat:msg:${userId}`,
    maximo: 200,
    ventanaSegundos: 3600,
    mensaje: "Llegaste al máximo de mensajes por hora. Probá más tarde.",
  }),
  imagenes: (userId: string): Limite => ({
    clave: `chat:img:${userId}`,
    maximo: 10,
    ventanaSegundos: 600,
    mensaje: "Llegaste al máximo de fotos por ahora. Probá en unos minutos.",
  }),
  propuestas: (userId: string): Limite => ({
    clave: `chat:prop:${userId}`,
    maximo: 10,
    ventanaSegundos: 3600,
    mensaje: "Hiciste muchas propuestas de horario. Probá más tarde.",
  }),
};

/** Registra un intento; si supera el máximo de la ventana, corta la acción con un mensaje claro. */
export async function consumirLimite(...limites: Limite[]): Promise<void> {
  const ahora = new Date();
  for (const limite of limites) {
    const [fila] = await prisma.$queryRaw<{ cantidad: number }[]>(
      consultaConsumir(limite.clave, inicioVentana(ahora, limite.ventanaSegundos)),
    );
    if ((fila?.cantidad ?? 0) > limite.maximo) throw new ActionError(limite.mensaje);
  }
  // Limpieza ocasional de ventanas viejas, sin bloquear la respuesta.
  if (Math.random() < 0.01) {
    prisma.$executeRaw(consultaLimpiar(new Date(ahora.getTime() - 24 * 3600 * 1000))).catch(() => undefined);
  }
}
