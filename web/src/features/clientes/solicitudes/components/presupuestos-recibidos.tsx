"use client";

import { BadgeCheck, MessagesSquare, Truck } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Estrellas } from "@/components/shared/estrellas";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ETIQUETA_VEHICULO } from "@/domain/catalogos";
import { destacados, ordenarPresupuestos, type CriterioOrden } from "@/domain/solicitud";
import { aceptarPresupuesto } from "@/features/clientes/presupuestos/actions";
import { hrefFlete } from "@/features/fletes/rutas";
import { formatearFechaHora, formatearPesos, formatearRating } from "@/lib/formato";
import { cn } from "@/lib/utils";
import type { PresupuestoRecibido } from "../queries";

const CRITERIOS: { valor: CriterioOrden; etiqueta: string }[] = [
  { valor: "precio", etiqueta: "Más baratos" },
  { valor: "calificacion", etiqueta: "Mejor calificados" },
  { valor: "vencimiento", etiqueta: "Por vencer" },
];

/**
 * Presupuestos pendientes, comparables: se ordenan por precio, calificación (ponderada por la
 * cantidad de reseñas) o vencimiento, y se destacan el más barato y el mejor calificado.
 */
export function PresupuestosRecibidos({
  presupuestos,
  textoCuando,
  puedeAceptar,
}: {
  presupuestos: PresupuestoRecibido[];
  textoCuando: string;
  puedeAceptar: boolean;
}) {
  const router = useRouter();
  const [criterio, setCriterio] = useState<CriterioOrden>("precio");
  const [error, setError] = useState<string | null>(null);
  const vigentes = presupuestos.filter((p) => p.estado === "PENDIENTE" && !p.vencido);
  const marcas = destacados(vigentes);
  const ordenados = ordenarPresupuestos(vigentes, criterio);

  if (vigentes.length === 0) {
    return (
      <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
        Todavía no hay presupuestos vigentes. Les avisamos a los fleteros de la zona; cuando llegue uno, te
        notificamos.
      </p>
    );
  }

  return (
    <div className="grid gap-3">
      {vigentes.length > 1 ? (
        <div role="group" aria-label="Ordenar presupuestos" className="flex flex-wrap gap-2">
          {CRITERIOS.map((c) => (
            <Button
              key={c.valor}
              type="button"
              size="sm"
              variant="outline"
              aria-pressed={criterio === c.valor}
              className={cn(criterio === c.valor && "border-primary bg-primary/5")}
              onClick={() => setCriterio(c.valor)}
            >
              {c.etiqueta}
            </Button>
          ))}
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
      <ul className="grid gap-3">
        {ordenados.map((p) => (
          <li key={p.id} className="grid gap-3 rounded-lg border bg-card p-4 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="grid gap-1">
                <p className="flex flex-wrap items-center gap-2">
                  <Link
                    href={`/fleteros/${p.fletero.id}`}
                    className="font-bold underline-offset-2 hover:underline"
                  >
                    {p.fletero.nombre}
                  </Link>
                  {p.fletero.verificado ? (
                    <BadgeCheck className="size-4 text-success" aria-label="Fletero verificado" />
                  ) : null}
                  {marcas.masBarato === p.id ? <Badge variant="success">Más barato</Badge> : null}
                  {marcas.mejorCalificado === p.id ? (
                    <Badge variant="secondary">Mejor calificado</Badge>
                  ) : null}
                </p>
                <p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                  {p.rating !== null ? (
                    <>
                      <Estrellas puntaje={p.rating} />
                      <span>
                        {formatearRating(p.rating)} ({p.calificaciones})
                      </span>
                    </>
                  ) : (
                    <span>Sin calificaciones todavía</span>
                  )}
                  <span>
                    · {p.fletesCompletados} {p.fletesCompletados === 1 ? "flete hecho" : "fletes hechos"}
                  </span>
                </p>
              </div>
              <p className="text-right">
                <span className="block font-heading text-2xl font-extrabold">{formatearPesos(p.monto)}</span>
                <span className="text-xs text-muted-foreground">
                  vale hasta el {formatearFechaHora(p.validoHasta)}
                </span>
              </p>
            </div>
            <p className="flex flex-wrap items-center gap-2 text-sm">
              <Truck className="size-4 text-muted-foreground" aria-hidden="true" />
              {ETIQUETA_VEHICULO[p.vehiculo.tipo]} · {p.vehiculo.marca} {p.vehiculo.modelo}
              {p.ayudantes ? ` · ${p.ayudantes} ${p.ayudantes === 1 ? "ayudante" : "ayudantes"}` : ""}
            </p>
            {p.mensaje ? (
              <p className="whitespace-pre-line rounded-md bg-muted/40 p-3 text-sm">«{p.mensaje}»</p>
            ) : null}
            <div className="flex flex-wrap gap-2">
              {puedeAceptar ? (
                <ConfirmDialog
                  title="¿Aceptar este presupuesto?"
                  description={
                    <>
                      Confirmás el flete con <strong>{p.fletero.nombre}</strong> por{" "}
                      <strong>{formatearPesos(p.monto)}</strong> para el <strong>{textoCuando}</strong>. Los
                      demás presupuestos se rechazan.
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
                    router.push(hrefFlete("CLIENTE", r.data.fleteId));
                  }}
                  trigger={(abrir) => (
                    <Button type="button" onClick={abrir}>
                      Aceptar
                    </Button>
                  )}
                />
              ) : null}
              {p.conversacionId ? (
                <Button asChild variant="secondary">
                  <Link href={`/cliente/mensajes/${p.conversacionId}`}>
                    <MessagesSquare aria-hidden="true" />
                    Chatear
                  </Link>
                </Button>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
