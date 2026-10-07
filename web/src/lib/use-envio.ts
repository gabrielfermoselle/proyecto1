"use client";

import { useCallback, useState } from "react";
import type { FieldValues, UseFormSetError } from "react-hook-form";
import { aplicarErroresDeCampo, type ActionResult } from "./action-result";

export interface MensajeFormulario {
  tipo: "ok" | "error";
  texto: string;
}

/**
 * Ejecuta una Server Action desde un formulario: muestra el error general, marca los errores
 * por campo y, si se pide, un mensaje de éxito. Devuelve `{ data }` si salió bien o `null` si falló.
 */
export function useEnvio<F extends FieldValues>(setError?: UseFormSetError<F>) {
  const [mensaje, setMensaje] = useState<MensajeFormulario | null>(null);

  const enviar = useCallback(
    async <T>(accion: () => Promise<ActionResult<T>>, exito?: string): Promise<{ data: T } | null> => {
      setMensaje(null);
      let resultado: ActionResult<T>;
      try {
        resultado = await accion();
      } catch {
        setMensaje({ tipo: "error", texto: "No pudimos conectarnos. Revisá tu conexión y probá de nuevo." });
        return null;
      }
      if (!resultado.ok) {
        setMensaje({ tipo: "error", texto: resultado.error });
        if (setError) aplicarErroresDeCampo(resultado.fieldErrors, setError);
        return null;
      }
      if (exito) setMensaje({ tipo: "ok", texto: exito });
      return { data: resultado.data };
    },
    [setError],
  );

  return { mensaje, enviar, limpiarMensaje: () => setMensaje(null) };
}
