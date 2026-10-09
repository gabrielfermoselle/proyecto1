import { Check, X } from "lucide-react";
import { estadoPedido, etiquetaEstadoPedido, pasosPedido, type EstadoPedido } from "@/domain/pedido";
import { cn } from "@/lib/utils";

type DatosEstado = Parameters<typeof estadoPedido>[0];

/**
 * Barra de estado del pedido: Esperando ▸ Aceptado ▸ En camino ▸ Finalizado. Va siempre arriba
 * del detalle, para que se vea de un vistazo en qué está.
 */
export function EstadoPedidoBar({ estado, className }: { estado: DatosEstado; className?: string }) {
  const e = estadoPedido(estado);
  const pasos = pasosPedido(e);
  return (
    <ol aria-label="Estado del pedido" className={cn("grid grid-cols-4", className)}>
      {pasos.map((p, i) => (
        <li
          key={p.clave}
          aria-current={p.estado === "actual" ? "step" : undefined}
          className="relative grid justify-items-center gap-2 text-center"
        >
          {i > 0 ? (
            <span
              aria-hidden="true"
              className={cn(
                "absolute right-1/2 top-4 h-1 w-full -translate-y-1/2 rounded-full",
                p.estado === "pendiente" ? "bg-border" : "bg-success",
              )}
            />
          ) : null}
          <span
            className={cn(
              "relative z-10 grid size-8 place-items-center rounded-full font-heading text-sm font-extrabold",
              p.estado === "hecho" && "bg-success text-success-foreground",
              p.estado === "actual" && "bg-primary text-primary-foreground ring-4 ring-primary/20",
              p.estado === "pendiente" && "border-2 border-border bg-card text-muted-foreground",
              p.estado === "cancelado" && "bg-destructive text-destructive-foreground",
            )}
          >
            {p.estado === "hecho" ? (
              <Check className="size-4 stroke-[3]" aria-hidden="true" />
            ) : p.estado === "cancelado" ? (
              <X className="size-4 stroke-[3]" aria-hidden="true" />
            ) : (
              i + 1
            )}
          </span>
          <span
            className={cn(
              "text-xs font-semibold leading-tight sm:text-sm",
              p.estado === "pendiente" ? "text-muted-foreground" : "text-foreground",
            )}
          >
            {p.titulo}
            <span className="sr-only">
              {" "}
              ({p.estado === "hecho" ? "hecho" : p.estado === "actual" ? "en curso" : p.estado})
            </span>
          </span>
        </li>
      ))}
    </ol>
  );
}

/** Versión compacta para las listas: cuatro segmentos y el nombre del estado. */
export function EstadoPedidoMini({ estado, className }: { estado: DatosEstado; className?: string }) {
  const e: EstadoPedido = estadoPedido(estado);
  const pasos = pasosPedido(e);
  return (
    <div className={cn("grid gap-1.5", className)}>
      <p
        className={cn(
          "text-xs font-bold uppercase tracking-wide",
          e.interrupcion ? "text-muted-foreground" : e.completo ? "text-success" : "text-primary",
        )}
      >
        {etiquetaEstadoPedido(e)}
      </p>
      <span aria-hidden="true" className="grid grid-cols-4 gap-1">
        {pasos.map((p) => (
          <span
            key={p.clave}
            className={cn(
              "h-1.5 rounded-full",
              p.estado === "hecho" && "bg-success",
              p.estado === "actual" && "bg-primary",
              p.estado === "pendiente" && "bg-border",
              p.estado === "cancelado" && "bg-muted-foreground/50",
            )}
          />
        ))}
      </span>
    </div>
  );
}
