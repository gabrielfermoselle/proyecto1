"use client";

import { Bell, CalendarClock, FileText, MessageCircle, Truck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { useChat } from "@/features/chat/components/chat-provider";
import { formatearFechaHora } from "@/lib/formato";
import { cn } from "@/lib/utils";
import { marcarNotificacionesLeidas } from "../actions";

const ICONO = {
  MENSAJE: MessageCircle,
  PRESUPUESTO: FileText,
  FLETE: Truck,
  PROPUESTA: CalendarClock,
} as const;

/** Campana con las notificaciones dentro de la app. Se actualiza en vivo (o por consultas). */
export function CampanaNotificaciones() {
  const { notificaciones, refrescarNotificaciones } = useChat();
  const [abierta, setAbierta] = useState(false);
  const router = useRouter();
  const panelId = useId();
  const contenedor = useRef<HTMLDivElement>(null);
  const boton = useRef<HTMLButtonElement>(null);

  // Cerrar con Escape o tocando afuera; el foco vuelve a la campana.
  useEffect(() => {
    if (!abierta) return;
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setAbierta(false);
        boton.current?.focus();
      }
    };
    const alTocar = (e: PointerEvent) => {
      if (!contenedor.current?.contains(e.target as Node)) setAbierta(false);
    };
    document.addEventListener("keydown", alTeclear);
    document.addEventListener("pointerdown", alTocar);
    return () => {
      document.removeEventListener("keydown", alTeclear);
      document.removeEventListener("pointerdown", alTocar);
    };
  }, [abierta]);

  async function abrir(id: string, href: string) {
    setAbierta(false);
    await marcarNotificacionesLeidas({ ids: [id] });
    refrescarNotificaciones();
    router.push(href);
  }

  async function marcarTodas() {
    await marcarNotificacionesLeidas({});
    refrescarNotificaciones();
  }

  const { noLeidas, items } = notificaciones;

  return (
    <div ref={contenedor} className="relative">
      <Button
        ref={boton}
        variant="ghost"
        size="icon"
        aria-expanded={abierta}
        aria-controls={panelId}
        onClick={() => setAbierta((a) => !a)}
        className="relative"
      >
        <Bell aria-hidden="true" />
        <span className="sr-only">Notificaciones{noLeidas > 0 ? `, ${noLeidas} sin leer` : ""}</span>
        {noLeidas > 0 ? (
          <span
            className="absolute right-1.5 top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground"
            aria-hidden="true"
          >
            {noLeidas > 9 ? "9+" : noLeidas}
          </span>
        ) : null}
      </Button>
      {abierta ? (
        <div
          id={panelId}
          role="region"
          aria-label="Notificaciones"
          className="fixed inset-x-2 top-16 z-40 max-h-[70vh] overflow-y-auto rounded-lg border bg-popover shadow-xl sm:absolute sm:inset-x-auto sm:right-0 sm:top-12 sm:w-96"
        >
          <div className="flex items-center justify-between gap-2 border-b px-4 py-3">
            <h2 className="font-bold">Notificaciones</h2>
            {noLeidas > 0 ? (
              <Button variant="link" size="sm" className="h-auto px-0" onClick={() => void marcarTodas()}>
                Marcar todas como leídas
              </Button>
            ) : null}
          </div>
          {items.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">No tenés notificaciones.</p>
          ) : (
            <ul className="divide-y">
              {items.map((n) => {
                const Icono = ICONO[n.tipo as keyof typeof ICONO] ?? Bell;
                return (
                  <li key={n.id}>
                    <button
                      type="button"
                      onClick={() => void abrir(n.id, n.href)}
                      className={cn(
                        "flex w-full gap-3 px-4 py-3 text-left hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                        !n.leida && "bg-primary/5",
                      )}
                    >
                      <Icono
                        className={cn(
                          "mt-0.5 size-5 shrink-0",
                          n.leida ? "text-muted-foreground" : "text-primary",
                        )}
                        aria-hidden="true"
                      />
                      <span className="grid gap-0.5">
                        <span className={cn("text-sm", !n.leida && "font-semibold")}>{n.titulo}</span>
                        {n.cuerpo ? (
                          <span className="line-clamp-2 text-sm text-muted-foreground">{n.cuerpo}</span>
                        ) : null}
                        <span className="text-xs text-muted-foreground">
                          {formatearFechaHora(new Date(n.fecha))}
                          {!n.leida ? <span className="sr-only"> · sin leer</span> : null}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
