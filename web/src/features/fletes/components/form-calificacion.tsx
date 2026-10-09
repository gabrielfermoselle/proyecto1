"use client";

import { Star } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { calificarFlete } from "../actions";

const ETIQUETAS = ["Muy malo", "Malo", "Regular", "Bueno", "Excelente"];

/** Calificación del cliente al fletero: de 1 a 5 estrellas y un comentario opcional. */
export function FormCalificacion({
  fleteId,
  fletero,
  volverA,
}: {
  fleteId: string;
  fletero: string;
  /** Adónde ir después de calificar. */
  volverA?: string;
}) {
  const router = useRouter();
  const [puntaje, setPuntaje] = useState(0);
  const [comentario, setComentario] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();
  const idComentario = useId();

  return (
    <form
      className="grid gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        startTransition(async () => {
          const r = await calificarFlete({ fleteId, puntaje, comentario });
          if (!r.ok) setError(r.error);
          else if (volverA) router.push(volverA);
        });
      }}
    >
      <fieldset className="grid gap-2">
        <legend className="mb-1 font-semibold">¿Cómo fue el flete con {fletero}?</legend>
        <div className="flex gap-1">
          {ETIQUETAS.map((etiqueta, i) => {
            const valor = i + 1;
            return (
              <label
                key={valor}
                className="cursor-pointer rounded-md p-1 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring"
              >
                <input
                  type="radio"
                  name="puntaje"
                  value={valor}
                  checked={puntaje === valor}
                  onChange={() => setPuntaje(valor)}
                  className="sr-only"
                />
                <Star
                  aria-hidden="true"
                  className={cn(
                    "size-11 transition-colors",
                    valor <= puntaje ? "fill-accent text-accent" : "text-muted-foreground/50",
                  )}
                />
                <span className="sr-only">
                  {valor} {valor === 1 ? "estrella" : "estrellas"}: {etiqueta}
                </span>
              </label>
            );
          })}
        </div>
        <p className="h-5 text-sm text-muted-foreground" aria-live="polite">
          {puntaje ? ETIQUETAS[puntaje - 1] : ""}
        </p>
      </fieldset>
      <div className="grid gap-2">
        <Label htmlFor={idComentario}>
          Comentario{" "}
          <span className="font-normal text-muted-foreground">(opcional, lo ven otros clientes)</span>
        </Label>
        <Textarea
          id={idComentario}
          rows={3}
          maxLength={1000}
          value={comentario}
          onChange={(e) => setComentario(e.target.value)}
          placeholder="Ej.: Puntual y muy cuidadoso con los muebles."
        />
      </div>
      {error ? (
        <p role="alert" className="text-sm font-medium text-destructive">
          {error}
        </p>
      ) : null}
      <Button type="submit" size="lg" disabled={puntaje === 0 || pendiente} className="justify-self-start">
        {pendiente ? "Enviando…" : "Enviar calificación"}
      </Button>
    </form>
  );
}
