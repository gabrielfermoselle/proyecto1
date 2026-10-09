import "server-only";
import { db, fallar } from "@/lib/db";

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
  const [lista, conteo] = await Promise.all([
    db()
      .from("notificaciones")
      .select("id, tipo, titulo, cuerpo, href, leidaEn, updatedAt")
      .eq("userId", userId)
      .order("updatedAt", { ascending: false })
      .limit(limite),
    db()
      .from("notificaciones")
      .select("id", { count: "exact", head: true })
      .eq("userId", userId)
      .is("leidaEn", null),
  ]);
  fallar(lista.error);
  fallar(conteo.error);
  return {
    noLeidas: conteo.count ?? 0,
    items: (lista.data ?? []).map<NotificacionDto>((n) => ({
      id: n.id as string,
      tipo: n.tipo as string,
      titulo: n.titulo as string,
      cuerpo: (n.cuerpo as string | null) ?? null,
      href: n.href as string,
      leida: n.leidaEn != null,
      fecha: new Date(n.updatedAt as string).toISOString(),
    })),
  };
}
