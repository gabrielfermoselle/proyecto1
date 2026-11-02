import { Loader2 } from "lucide-react";

/** Mientras abre una conversación: la bandeja queda a la vista y el panel muestra que carga. */
export default function CargandoConversacion() {
  return (
    <div className="grid h-full place-items-center bg-background p-6" aria-busy="true">
      <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        Abriendo la conversación…
      </p>
    </div>
  );
}
