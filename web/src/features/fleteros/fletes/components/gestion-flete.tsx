"use client";

import { Check, CheckCheck, Loader2 } from "lucide-react";
import { useOptimistic, useState, useTransition } from "react";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { EtapaFlete } from "@/domain/catalogos";
import {
  ACCION_FLETERO,
  faseInventario,
  puedeCancelar,
  siguienteEtapaFletero,
  validarTransicion,
} from "@/domain/maquina-estados";
import { cn } from "@/lib/utils";
import { avanzarEtapa, cancelarFlete, marcarItem, marcarTodos } from "../actions";

interface ItemFlete {
  id: string;
  nombre: string;
  cantidad: number;
  fragil: boolean;
  notas: string | null;
  cargadoEn: Date | null;
  descargadoEn: Date | null;
}

interface GestionFleteProps {
  fleteId: string;
  etapa: EtapaFlete;
  items: ItemFlete[];
}

const CONFIRMACION: Partial<Record<EtapaFlete, string>> = {
  CARGADO:
    "Confirmás que cargaste todo lo de la lista. El cliente va a ver que su carga está en tu vehículo.",
  EN_TRANSITO: "Le avisamos al cliente que saliste hacia el destino.",
  ENTREGADO:
    "Confirmás que descargaste todo en el destino. El cliente va a tener que confirmar la recepción.",
};

type Marcas = Record<string, boolean>;

/**
 * Inventario + botón principal. Comparten el estado optimista: al tildar el último ítem,
 * el botón se habilita al instante, sin esperar al servidor.
 */
export function GestionFlete({ fleteId, etapa, items }: GestionFleteProps) {
  const fase = faseInventario(etapa);
  const campo = fase === "descarga" ? "descargadoEn" : "cargadoEn";
  const marcasServidor: Marcas = Object.fromEntries(items.map((i) => [i.id, i[campo] !== null]));
  const [marcas, aplicarMarca] = useOptimistic(marcasServidor, (actual: Marcas, cambio: Marcas) => ({
    ...actual,
    ...cambio,
  }));
  const [pendiente, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [motivo, setMotivo] = useState("");

  const marcados = items.filter((i) => marcas[i.id]).length;
  const inventario = {
    total: items.length,
    cargados: items.filter((i) => (fase === "carga" ? marcas[i.id] : i.cargadoEn)).length,
    descargados: items.filter((i) => (fase === "descarga" ? marcas[i.id] : i.descargadoEn)).length,
  };
  const siguiente = siguienteEtapaFletero(etapa);
  const validacion = siguiente ? validarTransicion(etapa, siguiente, "FLETERO", inventario) : null;

  function ejecutar(accion: () => Promise<{ ok: boolean; error?: string }>, optimista?: Marcas) {
    setError(null);
    startTransition(async () => {
      if (optimista) aplicarMarca(optimista);
      const resultado = await accion();
      if (!resultado.ok) setError(resultado.error ?? "No se pudo guardar.");
    });
  }

  return (
    <div className="grid gap-5">
      {fase ? (
        <section aria-labelledby="titulo-inventario" className="grid gap-3">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 id="titulo-inventario" className="text-lg font-bold">
                {fase === "carga" ? "Marcá lo que vas cargando" : "Marcá lo que vas descargando"}
              </h2>
              <p className="text-sm text-muted-foreground" aria-live="polite">
                {marcados} de {items.length} {fase === "carga" ? "cargados" : "descargados"}
              </p>
            </div>
            {marcados < items.length ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={pendiente}
                onClick={() =>
                  ejecutar(() => marcarTodos({ fleteId }), Object.fromEntries(items.map((i) => [i.id, true])))
                }
              >
                <CheckCheck aria-hidden="true" />
                Marcar todo
              </Button>
            ) : null}
          </div>
          <div
            className="h-2 overflow-hidden rounded-full bg-muted"
            role="progressbar"
            aria-label="Avance del inventario"
            aria-valuemin={0}
            aria-valuemax={items.length}
            aria-valuenow={marcados}
          >
            <div
              className="h-full bg-success transition-all"
              style={{ width: `${(marcados / Math.max(items.length, 1)) * 100}%` }}
            />
          </div>
          <ul className="grid gap-2">
            {items.map((item) => {
              const marcado = Boolean(marcas[item.id]);
              return (
                <li key={item.id}>
                  <label
                    className={cn(
                      "flex min-h-14 cursor-pointer items-center gap-4 rounded-lg border-2 bg-card px-4 py-3 transition-colors",
                      "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring",
                      marcado ? "border-success bg-success/5" : "border-input",
                    )}
                  >
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={marcado}
                      onChange={(e) =>
                        ejecutar(() => marcarItem({ fleteId, itemId: item.id, marcado: e.target.checked }), {
                          [item.id]: e.target.checked,
                        })
                      }
                    />
                    <span
                      className={cn(
                        "grid size-8 shrink-0 place-items-center rounded-md border-2",
                        marcado ? "border-success bg-success text-success-foreground" : "border-input",
                      )}
                      aria-hidden="true"
                    >
                      {marcado ? <Check className="size-5" /> : null}
                    </span>
                    <span className="grid flex-1 gap-0.5">
                      <span className={cn("font-semibold", marcado && "text-muted-foreground line-through")}>
                        {item.cantidad > 1 ? `${item.cantidad} × ` : ""}
                        {item.nombre}
                      </span>
                      {item.notas ? (
                        <span className="text-sm text-muted-foreground">{item.notas}</span>
                      ) : null}
                    </span>
                    {item.fragil ? <Badge variant="destructive">Frágil</Badge> : null}
                  </label>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {error ? (
        <p
          role="alert"
          className="rounded-md bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive"
        >
          {error}
        </p>
      ) : null}

      {puedeCancelar(etapa, "FLETERO") ? (
        <ConfirmDialog
          title="¿Cancelar el flete?"
          description="El cliente va a tener que publicar la solicitud de nuevo. Cancelar seguido afecta tu reputación."
          confirmLabel="Cancelar el flete"
          variant="destructive"
          confirmDisabled={motivo.trim().length < 10}
          onConfirm={async () => {
            setError(null);
            const resultado = await cancelarFlete({ fleteId, motivo });
            if (!resultado.ok) {
              setError(resultado.error);
              return false;
            }
          }}
          trigger={(abrir) => (
            <Button
              type="button"
              variant="ghost"
              className="justify-self-start text-destructive"
              onClick={abrir}
            >
              No puedo hacer este flete
            </Button>
          )}
        >
          <div className="grid gap-2">
            <Label htmlFor="motivo-cancelacion">Motivo (lo ve el cliente)</Label>
            <Textarea
              id="motivo-cancelacion"
              rows={3}
              maxLength={300}
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Ej.: Se me rompió el vehículo y no llego a repararlo para esa fecha."
            />
          </div>
        </ConfirmDialog>
      ) : null}

      {siguiente ? (
        <div className="sticky bottom-[calc(4rem+env(safe-area-inset-bottom))] z-20 -mx-4 border-t bg-background/95 px-4 py-3 backdrop-blur md:bottom-0 md:mx-0 md:rounded-lg md:border">
          <ConfirmDialog
            title={ACCION_FLETERO[siguiente] ?? "Confirmar"}
            description={CONFIRMACION[siguiente] ?? ""}
            confirmLabel="Sí, confirmar"
            onConfirm={async () => {
              setError(null);
              const resultado = await avanzarEtapa({ fleteId, hacia: siguiente });
              if (!resultado.ok) setError(resultado.error);
            }}
            trigger={(abrir) => (
              <Button
                type="button"
                size="lg"
                className="h-16 w-full text-lg"
                disabled={pendiente || !validacion?.ok}
                onClick={abrir}
              >
                {pendiente ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
                {ACCION_FLETERO[siguiente]}
              </Button>
            )}
          />
          {validacion && !validacion.ok ? (
            <p className="mt-2 text-center text-sm text-muted-foreground">{validacion.motivo}</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
