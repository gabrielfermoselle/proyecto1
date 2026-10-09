"use client";

import { Bell, CalendarClock, ChevronRight, FileText, MessageCircle, Truck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { formatearFechaHora } from "@/lib/formato";
import { cn } from "@/lib/utils";
import { marcarNotificacionesLeidas } from "../actions";
import type { NotificacionDto } from "../queries";

export const ICONO_NOTIFICACION = {
  MENSAJE: MessageCircle,
  PRESUPUESTO: FileText,
  FLETE: Truck,
  PROPUESTA: CalendarClock,
} as const;

/** Todas las notificaciones, de la más reciente a la más vieja. Abrir una la marca como leída. */
export function ListaNotificaciones({ items, noLeidas }: { items: NotificacionDto[]; noLeidas: number }) {
  const router = useRouter();
  const [pendiente, startTransition] = useTransition();

  function abrir(n: NotificacionDto) {
    startTransition(async () => {
      if (!n.leida) await marcarNotificacionesLeidas({ ids: [n.id] });
      router.push(n.href);
    });
  }

  return (
    <div className="grid gap-3">
      {noLeidas > 0 ? (
        <Button
          variant="outline"
          size="sm"
          className="justify-self-start"
          disabled={pendiente}
          onClick={() =>
            startTransition(async () => {
              await marcarNotificacionesLeidas({});
              router.refresh();
            })
          }
        >
          Marcar las {noLeidas} como leídas
        </Button>
      ) : null}
      <ul className="divide-y overflow-hidden rounded-xl border bg-card shadow-sm">
        {items.map((n) => {
          const Icono = ICONO_NOTIFICACION[n.tipo as keyof typeof ICONO_NOTIFICACION] ?? Bell;
          return (
            <li key={n.id}>
              <button
                type="button"
                onClick={() => abrir(n)}
                disabled={pendiente}
                className={cn(
                  "flex w-full items-center gap-4 px-4 py-4 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:px-5",
                  !n.leida && "bg-accent/10",
                )}
              >
                <span
                  className={cn(
                    "grid size-10 shrink-0 place-items-center rounded-full",
                    n.leida ? "bg-muted text-muted-foreground" : "bg-primary text-primary-foreground",
                  )}
                >
                  <Icono className="size-5" aria-hidden="true" />
                </span>
                <span className="grid min-w-0 flex-1 gap-0.5">
                  <span className={cn(!n.leida && "font-semibold")}>{n.titulo}</span>
                  {n.cuerpo ? (
                    <span className="line-clamp-2 text-sm text-muted-foreground">{n.cuerpo}</span>
                  ) : null}
                  <span className="text-xs text-muted-foreground">
                    {formatearFechaHora(new Date(n.fecha))}
                    {!n.leida ? <span className="sr-only"> · sin leer</span> : null}
                  </span>
                </span>
                <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
