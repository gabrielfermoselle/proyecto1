import "server-only";
import { prisma } from "@/lib/prisma";

export interface NotificacionDto {
  id: string;
  tipo: string;
  titulo: string;
  cuerpo: string | null;
  href: string;
  leida: boolean;
  fecha: string;
}

export async function getNotificaciones(userId: string, limite = 15) {
  const [items, noLeidas] = await Promise.all([
    prisma.notificacion.findMany({
      where: { userId },
      orderBy: { updatedAt: "desc" },
      take: limite,
      select: {
        id: true,
        tipo: true,
        titulo: true,
        cuerpo: true,
        href: true,
        leidaEn: true,
        updatedAt: true,
      },
    }),
    prisma.notificacion.count({ where: { userId, leidaEn: null } }),
  ]);
  return {
    noLeidas,
    items: items.map<NotificacionDto>((n) => ({
      id: n.id,
      tipo: n.tipo,
      titulo: n.titulo,
      cuerpo: n.cuerpo,
      href: n.href,
      leida: n.leidaEn !== null,
      fecha: n.updatedAt.toISOString(),
    })),
  };
}
