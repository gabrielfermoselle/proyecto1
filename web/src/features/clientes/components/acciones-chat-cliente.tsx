"use client";

import Link from "next/link";
import { useState } from "react";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FRANJA } from "@/domain/catalogos";
import { puedeCancelar } from "@/domain/ciclo-flete";
import type { MetaConversacion } from "@/features/chat/queries";
import { cancelarFlete } from "@/features/fletes/actions";
import { formatearDia, formatearPesos } from "@/lib/formato";
import { aceptarPresupuesto } from "../presupuestos/actions";

type Resultado = { ok: true } | { ok: false; error: string };

function AvisoError({ mensaje }: { mensaje: string | null }) {
  return mensaje ? (
    <p role="alert" className="text-sm font-medium text-destructive">
      {mensaje}
    </p>
  ) : null;
}

/**
 * Acciones del cliente sobre el flete, a mano dentro del chat: aceptar el presupuesto mientras
 * se negocia, cancelar antes de la carga e ir a revisar la recepción cuando el fletero entregó
 * (la recepción es ítem por ítem, en la página de seguimiento).
 */
export function AccionesChatCliente({
  meta,
  onActualizado,
}: {
  meta: MetaConversacion;
  onActualizado: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [motivo, setMotivo] = useState("");

  const abrirLimpio = (abrir: () => void) => () => {
    setError(null);
    abrir();
  };

  async function ejecutar(accion: () => Promise<Resultado>): Promise<boolean> {
    setError(null);
    const resultado = await accion();
    if (!resultado.ok) {
      setError(resultado.error);
      return false;
    }
    onActualizado();
    return true;
  }

  const { presupuesto, flete } = meta;
  const puedeAceptar = meta.estado === "NEGOCIACION" && presupuesto?.estado === "PENDIENTE";
  const puedeConfirmar = meta.estado === "ACTIVA" && flete?.etapa === "ENTREGADO";
  // En CARGANDO depende de lo cargado: esa cancelación se ofrece en el seguimiento, con el inventario.
  const puedeCancelarFlete =
    meta.estado === "ACTIVA" &&
    flete !== null &&
    flete.etapa !== "CARGANDO" &&
    puedeCancelar(flete.etapa, "CLIENTE");
  if (!puedeAceptar && !puedeConfirmar && !puedeCancelarFlete) return null;

  const cuando = meta.fechaAcordada ?? meta.fechaActual;
  const textoCuando = `${formatearDia(cuando.fecha, { largo: true })}, ${FRANJA[cuando.franja].etiqueta.toLowerCase()}`;

  return (
    <div className="flex flex-wrap items-center justify-end gap-2 border-b bg-card px-3 py-2">
      {puedeAceptar && presupuesto ? (
        <ConfirmDialog
          title="¿Aceptar este presupuesto?"
          description={
            <>
              Confirmás el flete con <strong>{meta.contraparte}</strong> por{" "}
              <strong>{formatearPesos(presupuesto.monto)}</strong> para el <strong>{textoCuando}</strong>. Los
              demás presupuestos de esta solicitud se rechazan.
            </>
          }
          confirmLabel="Aceptar y confirmar"
          onConfirm={() => ejecutar(() => aceptarPresupuesto({ presupuestoId: presupuesto.id }))}
          trigger={(abrir) => (
            <Button type="button" size="sm" onClick={abrirLimpio(abrir)} className="max-sm:flex-1">
              Aceptar presupuesto · {formatearPesos(presupuesto.monto)}
            </Button>
          )}
        >
          {meta.fechaAcordada ? (
            <p className="text-sm text-muted-foreground">Es la fecha que acordaron en el chat.</p>
          ) : null}
          <AvisoError mensaje={error} />
        </ConfirmDialog>
      ) : null}

      {puedeConfirmar && flete ? (
        <Button asChild size="sm" className="max-sm:flex-1">
          <Link href={meta.hrefDetalle}>Revisar y confirmar la recepción</Link>
        </Button>
      ) : null}

      {puedeCancelarFlete && flete ? (
        <ConfirmDialog
          title="¿Cancelar el flete?"
          description="El chat queda bloqueado y vas a tener que publicar la solicitud de nuevo."
          confirmLabel="Cancelar el flete"
          variant="destructive"
          confirmDisabled={motivo.trim().length < 10}
          onConfirm={() => ejecutar(() => cancelarFlete({ fleteId: flete.id, motivo }))}
          trigger={(abrir) => (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-destructive"
              onClick={abrirLimpio(abrir)}
            >
              Cancelar flete
            </Button>
          )}
        >
          <div className="grid gap-2">
            <Label htmlFor="motivo-cancelacion-cliente">Motivo (lo ve el fletero)</Label>
            <Textarea
              id="motivo-cancelacion-cliente"
              rows={3}
              maxLength={300}
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Ej.: Se postergó la mudanza y todavía no tengo fecha nueva."
            />
          </div>
          <AvisoError mensaje={error} />
        </ConfirmDialog>
      ) : null}
    </div>
  );
}
