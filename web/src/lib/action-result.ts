// Tipos compartidos entre Server Actions y formularios cliente (sin `server-only`).
import type { FieldValues, Path, UseFormSetError } from "react-hook-form";

export type FieldErrors = Partial<Record<string, string[]>>;

export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string; fieldErrors?: FieldErrors };

/** Marca en el formulario los errores por campo que devolvió la Server Action. */
export function aplicarErroresDeCampo<F extends FieldValues>(
  fieldErrors: FieldErrors | undefined,
  setError: UseFormSetError<F>,
): void {
  for (const [campo, mensajes] of Object.entries(fieldErrors ?? {})) {
    const mensaje = mensajes?.[0];
    if (mensaje) setError(campo as Path<F>, { message: mensaje });
  }
}
