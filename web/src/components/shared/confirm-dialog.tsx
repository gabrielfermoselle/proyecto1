"use client";

import { useId, useRef, useState } from "react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ConfirmDialogProps {
  /** Botón que abre el diálogo. */
  trigger: (abrir: () => void) => React.ReactNode;
  title: string;
  description: React.ReactNode;
  confirmLabel: string;
  variant?: ButtonProps["variant"];
  /** Devolver `false` deja el diálogo abierto (por ejemplo, si la acción falló). */
  onConfirm: () => Promise<boolean | void>;
  /** Contenido extra entre la descripción y los botones (p. ej. un campo de motivo). */
  children?: React.ReactNode;
  confirmDisabled?: boolean;
}

/**
 * Confirmación para acciones irreversibles. Usa <dialog> nativo: atrapa el foco, cierra con
 * Esc y deja el resto de la página inerte, sin librerías.
 */
export function ConfirmDialog({
  trigger,
  title,
  description,
  confirmLabel,
  variant = "default",
  onConfirm,
  children,
  confirmDisabled,
}: ConfirmDialogProps) {
  const dialogo = useRef<HTMLDialogElement>(null);
  const tituloId = useId();
  const descripcionId = useId();
  const [enviando, setEnviando] = useState(false);

  const cerrar = () => dialogo.current?.close();

  async function confirmar() {
    setEnviando(true);
    try {
      const resultado = await onConfirm();
      if (resultado !== false) cerrar();
    } finally {
      setEnviando(false);
    }
  }

  return (
    <>
      {trigger(() => dialogo.current?.showModal())}
      <dialog
        ref={dialogo}
        aria-labelledby={tituloId}
        aria-describedby={descripcionId}
        className={cn(
          "w-[calc(100%-2rem)] max-w-md rounded-lg border bg-card p-0 text-card-foreground shadow-xl backdrop:bg-foreground/40",
          "max-sm:mb-4 max-sm:mt-auto",
        )}
        onClick={(e) => {
          if (e.target === dialogo.current && !enviando) cerrar();
        }}
      >
        <div className="grid gap-4 p-5">
          <h2 id={tituloId} className="text-lg font-bold">
            {title}
          </h2>
          <div id={descripcionId} className="text-muted-foreground">
            {description}
          </div>
          {children}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="ghost" onClick={cerrar} disabled={enviando} autoFocus>
              Volver
            </Button>
            <Button
              type="button"
              variant={variant}
              onClick={confirmar}
              disabled={enviando || confirmDisabled}
            >
              {enviando ? "Un momento…" : confirmLabel}
            </Button>
          </div>
        </div>
      </dialog>
    </>
  );
}
