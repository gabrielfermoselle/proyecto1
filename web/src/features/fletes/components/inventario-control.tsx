"use client";

import { Check, CheckCheck, MessageSquareWarning, PenLine } from "lucide-react";
import { useRouter } from "next/navigation";
import { useOptimistic, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import type { FaseControl, ResultadoControl } from "@/domain/catalogos";
import { RESULTADO_OK } from "@/domain/ciclo-flete";
import { cn } from "@/lib/utils";
import { marcarTodos, quitarControl, registrarControl } from "../actions";
import { TEXTOS_FASE, tonoResultado } from "../presentacion";
import type { ItemDto } from "../queries";
import { DetalleControl, EncabezadoItem } from "./detalle-control";
import { HojaControl } from "./hoja-control";

interface InventarioControlProps {
  fleteId: string;
  fase: FaseControl;
  items: ItemDto[];
  fotosHabilitadas: boolean;
}

type Marcas = Record<string, ResultadoControl | null>;

const controlDe = (item: ItemDto, fase: FaseControl) =>
  fase === "CARGA" ? item.carga : fase === "DESCARGA" ? item.descarga : item.recepcion;

/**
 * Control ítem por ítem de la fase actual: check-in al cargar, check-out al descargar o la
 * revisión del cliente al recibir. Un toque marca "todo bien" al instante (optimista) y otro lo
 * deshace; el detalle (observación, problema, reclamo, foto) va en una hoja aparte.
 */
export function InventarioControl({ fleteId, fase, items, fotosHabilitadas }: InventarioControlProps) {
  const router = useRouter();
  const textos = TEXTOS_FASE[fase];
  // En descarga y recepción solo cuenta lo que viajó.
  const relevantes = fase === "CARGA" ? items : items.filter((i) => i.carga?.resultado === "CARGADO");
  const delServidor: Marcas = Object.fromEntries(
    relevantes.map((i) => [i.id, controlDe(i, fase)?.resultado ?? null]),
  );
  const [marcas, marcar] = useOptimistic(delServidor, (actual: Marcas, cambio: Marcas) => ({
    ...actual,
    ...cambio,
  }));
  const [pendiente, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const resueltos = relevantes.filter((i) => marcas[i.id]).length;
  const faltan = relevantes.length - resueltos;
  const ok = RESULTADO_OK[fase];

  function ejecutar(accion: () => Promise<{ ok: boolean; error?: string }>, optimista: Marcas) {
    setError(null);
    startTransition(async () => {
      marcar(optimista);
      const r = await accion();
      if (!r.ok) setError(r.error ?? "No se pudo guardar.");
      else router.refresh();
    });
  }

  return (
    <section aria-labelledby="titulo-control" className="grid gap-3">
      <div className="grid gap-1">
        <h2 id="titulo-control" className="text-lg font-bold">
          {textos.titulo}
        </h2>
        <p className="text-sm text-muted-foreground">{textos.ayuda}</p>
      </div>

      <div className="sticky top-16 z-10 -mx-4 grid gap-2 border-b bg-background/95 px-4 py-2 backdrop-blur md:static md:mx-0 md:border-0 md:bg-transparent md:p-0">
        <div className="flex items-center justify-between gap-2">
          <p className="font-semibold tabular-nums" aria-live="polite">
            {resueltos} de {relevantes.length} {textos.hechos}
          </p>
          {faltan > 0 ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={pendiente}
              onClick={() =>
                ejecutar(
                  () => marcarTodos({ fleteId, fase }),
                  Object.fromEntries(relevantes.filter((i) => !marcas[i.id]).map((i) => [i.id, ok])),
                )
              }
            >
              <CheckCheck aria-hidden="true" />
              {faltan === relevantes.length ? "Todo" : `Los ${faltan} que faltan`}: {textos.ok.toLowerCase()}
            </Button>
          ) : null}
        </div>
        <div
          className="h-2 overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-label={`Avance: ${textos.titulo.toLowerCase()}`}
          aria-valuemin={0}
          aria-valuemax={relevantes.length}
          aria-valuenow={resueltos}
        >
          <div
            className="h-full bg-success transition-all"
            style={{ width: `${(resueltos / Math.max(relevantes.length, 1)) * 100}%` }}
          />
        </div>
      </div>

      {error ? (
        <p
          role="alert"
          className="rounded-md bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive"
        >
          {error}
        </p>
      ) : null}

      <ul className="grid gap-2">
        {relevantes.map((item) => {
          const resultado = marcas[item.id];
          const control = controlDe(item, fase);
          const conReclamo = Boolean(item.reclamo);
          // Un toque de más no puede borrar un daño reportado o una foto: eso se corrige en la hoja.
          const protegido =
            Boolean(control) &&
            resultado === control?.resultado &&
            Boolean(
              control?.observacion || control?.fotos.length || tonoResultado(control!.resultado) !== "ok",
            );
          const tono = resultado ? tonoResultado(resultado) : null;
          // Lo que ya se registró antes, para comparar: al descargar, la carga; al recibir, la carga
          // (si tuvo observación, p. ej. un rayón previo) y la descarga.
          const conDetalle = (c: ItemDto["carga"]) => Boolean(c && (c.observacion || c.fotos.length > 0));
          const previos = [
            fase !== "CARGA" && conDetalle(item.carga)
              ? { etiqueta: "Al cargar", control: item.carga! }
              : null,
            fase === "RECEPCION" && item.descarga
              ? { etiqueta: "Al descargar", control: item.descarga }
              : null,
          ].filter((x) => x !== null);
          const mostrarRegistrado =
            control &&
            resultado === control.resultado &&
            (control.observacion || control.fotos.length > 0 || tono !== "ok");
          return (
            <li
              key={item.id}
              className={cn(
                "grid gap-3 rounded-lg border-2 bg-card p-3 transition-colors",
                tono === "ok" && "border-success bg-success/5",
                tono === "alerta" && "border-destructive/60 bg-destructive/5",
                tono === "neutro" && "border-muted-foreground/40 bg-muted/40",
                !tono && "border-input",
              )}
            >
              <div className="flex items-start gap-3">
                <button
                  type="button"
                  aria-pressed={Boolean(resultado)}
                  disabled={conReclamo || protegido}
                  title={protegido && !conReclamo ? `Para cambiarlo, usá «${textos.conDetalle}»` : undefined}
                  onClick={() =>
                    resultado
                      ? ejecutar(() => quitarControl({ fleteId, itemId: item.id, fase }), { [item.id]: null })
                      : ejecutar(
                          () =>
                            registrarControl({
                              fleteId,
                              itemId: item.id,
                              fase,
                              resultado: ok,
                              observacion: null,
                            }),
                          { [item.id]: ok },
                        )
                  }
                  className={cn(
                    "grid size-12 shrink-0 place-items-center rounded-lg border-2 transition-colors",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed",
                    tono === "ok" && "border-success bg-success text-success-foreground",
                    tono === "alerta" && "border-destructive bg-destructive text-destructive-foreground",
                    tono === "neutro" && "border-muted-foreground bg-muted-foreground text-background",
                    !tono && "border-input hover:border-success",
                  )}
                >
                  {tono === "alerta" ? (
                    <MessageSquareWarning className="size-6" aria-hidden="true" />
                  ) : resultado ? (
                    <Check className="size-6" aria-hidden="true" />
                  ) : null}
                  <span className="sr-only">
                    {resultado ? `Deshacer: ${item.nombre}` : `${textos.ok}: ${item.nombre}`}
                  </span>
                </button>
                <div className="min-w-0 flex-1">
                  <EncabezadoItem item={item} />
                </div>
              </div>

              {previos.map((p) => (
                <DetalleControl
                  key={p.etiqueta}
                  etiqueta={p.etiqueta}
                  control={p.control}
                  item={item.nombre}
                />
              ))}
              {mostrarRegistrado && control ? (
                <DetalleControl etiqueta="Registrado" control={control} item={item.nombre} />
              ) : null}
              {item.reclamo ? (
                <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  Reclamo abierto: «{item.reclamo.descripcion}»
                </p>
              ) : null}

              {!conReclamo ? (
                <HojaControl
                  fleteId={fleteId}
                  fase={fase}
                  item={item}
                  actual={control}
                  fotosHabilitadas={fotosHabilitadas}
                  trigger={(abrir) => (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={abrir}
                      className={cn("justify-self-start", fase === "RECEPCION" && "text-destructive")}
                    >
                      {fase === "RECEPCION" ? (
                        <MessageSquareWarning aria-hidden="true" />
                      ) : (
                        <PenLine aria-hidden="true" />
                      )}
                      {textos.conDetalle}
                    </Button>
                  )}
                />
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
