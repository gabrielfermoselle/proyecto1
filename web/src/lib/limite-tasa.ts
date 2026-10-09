import "server-only";
import { ActionError } from "./action";
import { consumirVentana, inicioVentana, limpiarVentanasViejas } from "./limite-tasa-sql";

export interface Limite {
  clave: string;
  maximo: number;
  ventanaSegundos: number;
  mensaje: string;
}

const MUY_RAPIDO = "Estás enviando muy rápido. Esperá un momento y probá de nuevo.";

export const LIMITES = {
  solicitudes: (userId: string): Limite => ({
    clave: `solicitud:${userId}`,
    maximo: 10,
    ventanaSegundos: 24 * 3600,
    mensaje: "Publicaste muchas solicitudes hoy. Probá mañana o escribinos si lo necesitás.",
  }),
  registros: (ip: string): Limite => ({
    clave: `auth:registro:${ip}`,
    maximo: 5,
    ventanaSegundos: 3600,
    mensaje: "Se crearon muchas cuentas desde esta conexión. Probá más tarde.",
  }),
  /** Adivinar la contraseña actual desde una sesión robada: mismo criterio que el login. */
  cambiosContrasena: (userId: string): Limite => ({
    clave: `auth:cambio:${userId}`,
    maximo: 5,
    ventanaSegundos: 15 * 60,
    mensaje: "Hubo demasiados intentos. Esperá unos minutos y probá de nuevo.",
  }),
  recuperacionesPorIp: (ip: string): Limite => ({
    clave: `auth:recuperar:ip:${ip}`,
    maximo: 10,
    ventanaSegundos: 3600,
    mensaje: "Se pidieron muchos links desde esta conexión. Probá más tarde.",
  }),
  /** No inundar la casilla de nadie: también aplica a emails que no existen (no revela nada). */
  recuperacionesPorEmail: (email: string): Limite => ({
    clave: `auth:recuperar:email:${email}`,
    maximo: 3,
    ventanaSegundos: 3600,
    mensaje: "Ya te enviamos varios links. Revisá tu correo (y el spam) o probá en una hora.",
  }),
  restablecimientosPorIp: (ip: string): Limite => ({
    clave: `auth:restablecer:ip:${ip}`,
    maximo: 20,
    ventanaSegundos: 3600,
    mensaje: "Hubo demasiados intentos desde esta conexión. Probá más tarde.",
  }),
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
    const cantidad = await consumirVentana(limite.clave, inicioVentana(ahora, limite.ventanaSegundos));
    if (cantidad > limite.maximo) throw new ActionError(limite.mensaje);
  }
  if (Math.random() < 0.01) {
    limpiarVentanasViejas(new Date(ahora.getTime() - 24 * 3600 * 1000)).catch(() => undefined);
  }
}
