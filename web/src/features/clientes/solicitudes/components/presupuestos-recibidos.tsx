"use client";

import { BadgeCheck, Clock, MessagesSquare, Package, Star, Truck, Users } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ETIQUETA_VEHICULO } from "@/domain/catalogos";
import { destacados, ordenarPresupuestos, type CriterioOrden } from "@/domain/solicitud";
import { aceptarPresupuesto } from "@/features/clientes/presupuestos/actions";
import { hrefConversacion } from "@/features/chat/acceso-rutas";
import { formatearFechaHora, formatearPesos, formatearRating } from "@/lib/formato";
import { cn } from "@/lib/utils";
import type { PresupuestoRecibido } from "../queries";

const CRITERIOS: { valor: CriterioOrden; etiqueta: string }[] = [
  { valor: "precio", etiqueta: "Precio" },
  { valor: "calificacion", etiqueta: "Calificación" },
  { valor: "vencimiento", etiqueta: "Por vencer" },
];

/**
 * Presupuestos pendientes, comparables en filas: fletero (calificación, viajes y verificación),
 * vehículo, precio y acciones. Se ordenan por precio, calificación (ponderada por la cantidad de
 * reseñas) o vencimiento, y se marcan el más barato y el mejor calificado.
 */
export function PresupuestosRecibidos({
  solicitudId,
  presupuestos,
  textoCuando,
  puedeAceptar,
  pideEmbalaje,
}: {
  solicitudId: string;
  presupuestos: PresupuestoRecibido[];
  textoCuando: string;
  puedeAceptar: boolean;
  pideEmbalaje: boolean;
}) {
  const router = useRouter();
  const [criterio, setCriterio] = useState<CriterioOrden>("precio");
  const [error, setError] = useState<string | null>(null);
  const vigentes = presupuestos.filter((p) => p.estado === "PENDIENTE" && !p.vencido);
  const marcas = destacados(vigentes);
  const ordenados = ordenarPresupuestos(vigentes, criterio);

  if (vigentes.length === 0) {
    return (
      <div className="grid justify-items-center gap-2 rounded-xl border border-dashed bg-card/60 px-6 py-10 text-center">
        <span className="relative grid size-12 place-items-center rounded-full bg-accent/20 text-foreground">
          <Clock className="size-6" aria-hidden="true" />
        </span>
        <p className="font-bold">Esperando presupuestos</p>
        <p className="max-w-md text-sm text-muted-foreground">
          Ya les avisamos a los fleteros de la zona. Cuando llegue el primero te mandamos una notificación.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      {vigentes.length > 1 ? (
        <div className="flex flex-wrap items-center gap-2">
          <span id="ordenar-por" className="text-sm text-muted-foreground">
            Ordenar por
          </span>
          <div role="group" aria-labelledby="ordenar-por" className="inline-flex rounded-lg bg-muted p-1">
            {CRITERIOS.map((c) => (
              <button
                key={c.valor}
                type="button"
                aria-pressed={criterio === c.valor}
                onClick={() => setCriterio(c.valor)}
                className={cn(
                  "h-8 rounded-md px-3 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  criterio === c.valor ? "bg-card shadow-sm" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {c.etiqueta}
              </button>
            ))}
          </div>
        </div>
      ) : null}
      {error ? (
        <p
          role="alert"
          className="rounded-md bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive"
        >
          {error}
        </p>
      ) : null}
      {pideEmbalaje ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Package className="size-4 shrink-0" aria-hidden="true" />
          Pediste embalaje: confirmá con cada fletero por el chat si lo incluye.
        </p>
      ) : null}
      <ul className="grid gap-3">
        {ordenados.map((p) => (
          <li
            key={p.id}
            className={cn(
              "grid gap-4 rounded-xl border bg-card p-4 shadow-sm sm:p-5",
              marcas.masBarato === p.id && criterio === "precio" && "border-success/50",
            )}
          >
            <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
              <div className="flex min-w-0 items-center gap-3">
                <span
                  aria-hidden="true"
                  className="grid size-12 shrink-0 place-items-center rounded-full bg-secondary font-heading text-lg font-extrabold text-secondary-foreground"
                >
                  {p.fletero.nombre.charAt(0)}
                </span>
                <div className="grid min-w-0 gap-1">
                  <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <Link
                      href={`/fleteros/${p.fletero.id}`}
                      className="truncate text-lg font-bold underline-offset-2 hover:underline"
                    >
                      {p.fletero.nombre}
                    </Link>
                    {p.fletero.verificado ? (
                      <Badge variant="success">
                        <BadgeCheck aria-hidden="true" />
                        Verificado
                      </Badge>
                    ) : null}
                  </p>
                  <p className="flex flex-wrap items-center gap-x-1.5 text-sm text-muted-foreground">
                    {p.rating !== null ? (
                      <>
                        <Star className="size-4 fill-accent text-accent" aria-hidden="true" />
                        <span className="font-semibold text-foreground">{formatearRating(p.rating)}</span>
                        <span>
                          ({p.calificaciones} {p.calificaciones === 1 ? "reseña" : "reseñas"})
                        </span>
                      </>
                    ) : (
                      <span>Sin reseñas</span>
                    )}
                    <span aria-hidden="true">·</span>
                    <span>
                      {p.fletesCompletados} {p.fletesCompletados === 1 ? "viaje" : "viajes"}
                    </span>
                  </p>
                </div>
              </div>
              <div className="grid justify-items-start gap-1 sm:justify-items-end sm:text-right">
                <p className="font-heading text-3xl font-extrabold tabular-nums leading-none">
                  {formatearPesos(p.monto)}
                </p>
                <p className="text-xs text-muted-foreground">
                  vale hasta el {formatearFechaHora(p.validoHasta)}
                </p>
                {marcas.masBarato === p.id || marcas.mejorCalificado === p.id ? (
                  <p className="flex flex-wrap gap-1.5">
                    {marcas.masBarato === p.id ? <Badge variant="success">Más barato</Badge> : null}
                    {marcas.mejorCalificado === p.id ? (
                      <Badge variant="secondary">Mejor calificado</Badge>
                    ) : null}
                  </p>
                ) : null}
              </div>
            </div>

            <ul className="flex flex-wrap gap-x-5 gap-y-1.5 border-t pt-3 text-sm">
              <li className="flex items-center gap-2">
                <Truck className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                {ETIQUETA_VEHICULO[p.vehiculo.tipo]} · {p.vehiculo.marca} {p.vehiculo.modelo}
              </li>
              <li className="flex items-center gap-2">
                <Users className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                {p.ayudantes
                  ? `Incluye ${p.ayudantes} ${p.ayudantes === 1 ? "ayudante" : "ayudantes"}`
                  : "Sin ayudantes"}
              </li>
              {p.horaLlegada ? (
                <li className="flex items-center gap-2">
                  <Clock className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                  Llega a las {p.horaLlegada} h
                </li>
              ) : null}
            </ul>

            {p.mensaje ? (
              <p className="whitespace-pre-line rounded-lg bg-muted/50 px-4 py-3 text-sm">
                <span className="sr-only">Mensaje de {p.fletero.nombre}: </span>«{p.mensaje}»
              </p>
            ) : null}

            <div className="flex flex-wrap justify-end gap-2">
              {p.conversacionId ? (
                <Button asChild variant="outline" className="max-sm:flex-1">
                  <Link href={hrefConversacion("CLIENTE", solicitudId, p.fletero.id)}>
                    <MessagesSquare aria-hidden="true" />
                    Chat
                  </Link>
                </Button>
              ) : null}
              {puedeAceptar ? (
                <ConfirmDialog
                  title="¿Aceptar este presupuesto?"
                  description={
                    <>
                      Confirmás el flete con <strong>{p.fletero.nombre}</strong> por{" "}
                      <strong>{formatearPesos(p.monto)}</strong> para el <strong>{textoCuando}</strong>. Los
                      demás presupuestos se rechazan y se habilita el contacto por WhatsApp o teléfono.
                    </>
                  }
                  confirmLabel="Aceptar y confirmar"
                  onConfirm={async () => {
                    setError(null);
                    const r = await aceptarPresupuesto({ presupuestoId: p.id });
                    if (!r.ok) {
                      setError(r.error);
                      return;
                    }
                    router.refresh();
                  }}
                  trigger={(abrir) => (
                    <Button type="button" onClick={abrir} className="max-sm:flex-1">
                      Aceptar {formatearPesos(p.monto)}
                    </Button>
                  )}
                />
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
