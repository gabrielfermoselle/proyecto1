"use client";

import { BadgeCheck, Loader2 } from "lucide-react";
import { useId, useState, useTransition } from "react";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cambiarEstadoUsuario, resolverReclamo, verificarFletero } from "../actions";

function AvisoError({ mensaje }: { mensaje: string | null }) {
  return mensaje ? (
    <p role="alert" className="text-sm font-medium text-destructive">
      {mensaje}
    </p>
  ) : null;
}

export function BotonEstadoUsuario({
  userId,
  nombre,
  activo,
}: {
  userId: string;
  nombre: string;
  activo: boolean;
}) {
  const [error, setError] = useState<string | null>(null);
  return (
    <ConfirmDialog
      title={activo ? `¿Desactivar a ${nombre}?` : `¿Reactivar a ${nombre}?`}
      description={
        activo
          ? "No va a poder entrar y deja de aparecer en búsquedas. Sus fletes en curso siguen visibles para la otra parte."
          : "Vuelve a poder entrar y a aparecer en la plataforma."
      }
      confirmLabel={activo ? "Desactivar" : "Reactivar"}
      variant={activo ? "destructive" : "default"}
      onConfirm={async () => {
        setError(null);
        const r = await cambiarEstadoUsuario({ userId, activo: !activo });
        if (!r.ok) {
          setError(r.error);
          return false;
        }
      }}
      trigger={(abrir) => (
        <Button
          type="button"
          size="sm"
          variant={activo ? "ghost" : "outline"}
          className={activo ? "text-destructive" : ""}
          onClick={abrir}
        >
          {activo ? "Desactivar" : "Reactivar"}
        </Button>
      )}
    >
      <AvisoError mensaje={error} />
    </ConfirmDialog>
  );
}

export function BotonVerificar({ fleteroId, verificado }: { fleteroId: string; verificado: boolean }) {
  const [pendiente, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <span className="grid gap-1">
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={pendiente}
        aria-pressed={verificado}
        onClick={() =>
          startTransition(async () => {
            setError(null);
            const r = await verificarFletero({ fleteroId, verificado: !verificado });
            if (!r.ok) setError(r.error);
          })
        }
      >
        {pendiente ? (
          <Loader2 className="animate-spin" aria-hidden="true" />
        ) : (
          <BadgeCheck aria-hidden="true" />
        )}
        {verificado ? "Quitar verificación" : "Verificar"}
      </Button>
      <AvisoError mensaje={error} />
    </span>
  );
}

export function FormResolverReclamo({ reclamoId }: { reclamoId: string }) {
  const idCampo = useId();
  const [resolucion, setResolucion] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();
  return (
    <form
      className="grid gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          setError(null);
          const r = await resolverReclamo({ reclamoId, resolucion });
          if (!r.ok) setError(r.error);
          else setResolucion("");
        });
      }}
    >
      <Label htmlFor={idCampo}>Resolución (la ven el cliente y el fletero)</Label>
      <Textarea
        id={idCampo}
        rows={3}
        maxLength={500}
        value={resolucion}
        onChange={(e) => setResolucion(e.target.value)}
        placeholder="Ej.: El fletero reintegra $ 15.000 por la caja dañada; lo acordaron por el chat."
      />
      <AvisoError mensaje={error} />
      <Button
        type="submit"
        size="sm"
        className="justify-self-start"
        disabled={pendiente || resolucion.trim().length < 10}
      >
        {pendiente ? "Guardando…" : "Marcar como resuelto"}
      </Button>
    </form>
  );
}
