import { AlertCircle, CheckCircle2 } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import type { MensajeFormulario } from "@/lib/use-envio";

/** Resultado de un envío. Los errores usan role="alert"; los éxitos se anuncian sin interrumpir. */
export function FormMensaje({ mensaje }: { mensaje: MensajeFormulario | null }) {
  if (!mensaje) return null;
  const esError = mensaje.tipo === "error";
  return (
    <Alert variant={esError ? "destructive" : "success"} role={esError ? "alert" : "status"}>
      {esError ? <AlertCircle aria-hidden="true" /> : <CheckCircle2 aria-hidden="true" />}
      <p>{mensaje.texto}</p>
    </Alert>
  );
}
