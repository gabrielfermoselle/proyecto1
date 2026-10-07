import "server-only";
import type { Prisma, TipoNotificacion } from "@prisma/client";
import type { Publicacion } from "@/lib/supabase";

export interface NuevaNotificacion {
  userId: string;
  tipo: TipoNotificacion;
  titulo: string;
  cuerpo?: string | null;
  href: string;
  /** Si viene, reemplaza a la notificación anterior con la misma clave (y la vuelve a marcar no leída). */
  clave?: string;
}

const recortar = (texto: string, largo: number) =>
  texto.length > largo ? `${texto.slice(0, largo - 1)}…` : texto;

export async function notificar(tx: Prisma.TransactionClient, n: NuevaNotificacion): Promise<Publicacion[]> {
  const datos = {
    tipo: n.tipo,
    titulo: recortar(n.titulo, 120),
    cuerpo: n.cuerpo ? recortar(n.cuerpo, 300) : null,
    href: n.href,
    leidaEn: null,
  };
  if (n.clave) {
    await tx.notificacion.upsert({
      where: { userId_clave: { userId: n.userId, clave: n.clave } },
      create: { ...datos, userId: n.userId, clave: n.clave },
      update: datos,
    });
  } else {
    await tx.notificacion.create({ data: { ...datos, userId: n.userId } });
  }
  return [{ topic: `usuario:${n.userId}`, event: "notificacion.creada", payload: {} }];
}
