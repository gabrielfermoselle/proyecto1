import { Bell } from "lucide-react";
import type { Metadata } from "next";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { ListaNotificaciones } from "@/features/notificaciones/components/lista-notificaciones";
import { getNotificaciones } from "@/features/notificaciones/queries";
import { requireUsuario } from "@/lib/session";

export const metadata: Metadata = { title: "Notificaciones" };

const TEXTO_VACIO = {
  CLIENTE: "Te avisamos acá cuando llegue un presupuesto, te escriban o cambie el estado de un pedido.",
  FLETERO: "Te avisamos acá cuando un cliente acepte tu presupuesto, te escriba o cambie algo de un flete.",
  ADMIN: "No hay avisos para la administración.",
} as const;

export default async function NotificacionesPage() {
  const usuario = await requireUsuario();
  const { items, noLeidas } = await getNotificaciones(usuario.id, 50);
  return (
    <div className="mx-auto grid max-w-3xl gap-2">
      <PageHeader
        title="Notificaciones"
        description={noLeidas > 0 ? `Tenés ${noLeidas} sin leer.` : "Estás al día."}
      />
      {items.length === 0 ? (
        <EmptyState
          icon={<Bell />}
          title="Todavía no tenés notificaciones"
          description={TEXTO_VACIO[usuario.rol]}
        />
      ) : (
        <ListaNotificaciones items={items} noLeidas={noLeidas} />
      )}
    </div>
  );
}
