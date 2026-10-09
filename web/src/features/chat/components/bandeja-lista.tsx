"use client";

import { Lock, MessagesSquare, Pin } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { EmptyState } from "@/components/shared/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { fechaIsoAr } from "@/domain/fechas";
import { formatearDia, formatearHora } from "@/lib/formato";
import { cn } from "@/lib/utils";
import { useChat } from "./chat-provider";

function cuando(iso: string): string {
  const instante = new Date(iso);
  const dia = fechaIsoAr(instante);
  return dia === fechaIsoAr() ? formatearHora(instante) : formatearDia(dia);
}

export function BandejaLista({ textoVacio }: { textoVacio: string }) {
  const { bandeja, refrescarBandeja } = useChat();
  const pathname = usePathname();

  useEffect(() => {
    refrescarBandeja();
  }, [refrescarBandeja]);

  if (bandeja === null) {
    return (
      <div className="grid gap-2 p-3" aria-busy="true" aria-label="Cargando conversaciones">
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  if (bandeja.length === 0) {
    return (
      <EmptyState
        icon={<MessagesSquare />}
        title="Todavía no tenés conversaciones"
        description={textoVacio}
        className="m-3"
      />
    );
  }

  return (
    <ul className="divide-y" aria-label="Conversaciones">
      {bandeja.map((c) => {
        const activa = pathname === c.href;
        const cerrada = c.estado === "CERRADA" || c.estado === "BLOQUEADA";
        return (
          <li key={c.id}>
            <Link
              href={c.href}
              aria-current={activa ? "page" : undefined}
              className={cn(
                "flex gap-3 px-3 py-3 transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                activa && "bg-muted",
              )}
            >
              <span
                className={cn(
                  "grid size-11 shrink-0 place-items-center rounded-full font-heading font-extrabold",
                  cerrada ? "bg-muted text-muted-foreground" : "bg-secondary text-secondary-foreground",
                )}
                aria-hidden="true"
              >
                {c.contraparte.charAt(0)}
              </span>
              <span className="grid min-w-0 flex-1 gap-0.5">
                <span className="flex items-baseline justify-between gap-2">
                  <span className={cn("truncate", c.noLeidos > 0 ? "font-bold" : "font-semibold")}>
                    {c.contraparte}
                  </span>
                  <span
                    className={cn(
                      "shrink-0 text-xs",
                      c.noLeidos > 0 ? "font-semibold text-primary" : "text-muted-foreground",
                    )}
                  >
                    {cuando(c.ultimaActividadEn)}
                  </span>
                </span>
                <span className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                  {c.fijada ? (
                    <Pin className="size-3 shrink-0 text-primary" aria-label="Flete en curso" />
                  ) : null}
                  {cerrada ? <Lock className="size-3 shrink-0" aria-label="Conversación cerrada" /> : null}
                  <span className="truncate">{c.titulo}</span>
                </span>
                <span className="flex items-center justify-between gap-2">
                  <span
                    className={cn(
                      "min-w-0 truncate text-sm",
                      c.noLeidos > 0 ? "text-foreground" : "text-muted-foreground",
                    )}
                  >
                    {c.vistaPrevia}
                  </span>
                  {c.noLeidos > 0 ? (
                    <span className="grid h-5 min-w-5 shrink-0 place-items-center rounded-full bg-primary px-1.5 text-xs font-bold text-primary-foreground">
                      {c.noLeidos > 99 ? "99+" : c.noLeidos}
                      <span className="sr-only"> mensajes sin leer</span>
                    </span>
                  ) : null}
                </span>
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
