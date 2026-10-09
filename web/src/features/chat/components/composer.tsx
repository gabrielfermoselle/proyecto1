"use client";

import { ImagePlus, Lock, SendHorizontal, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { LARGO_MAXIMO_MENSAJE } from "@/domain/chat";

const ALTO_MAXIMO_PX = 160;
const PESO_MAXIMO_FOTO = 15 * 1024 * 1024;

interface ComposerProps {
  bloqueo: string | null;
  fotosHabilitadas: boolean;
  contactoVisible: boolean;
  onEnviarTexto: (texto: string) => Promise<boolean>;
  onEnviarFoto: (archivo: File, texto: string) => Promise<boolean>;
  onEscribiendo: () => void;
  /** Acciones rápidas (p. ej. proponer fecha), a la izquierda del campo. */
  acciones?: React.ReactNode;
}

export function Composer({
  bloqueo,
  fotosHabilitadas,
  contactoVisible,
  onEnviarTexto,
  onEnviarFoto,
  onEscribiendo,
  acciones,
}: ComposerProps) {
  const idCampo = useId();
  const [texto, setTexto] = useState("");
  const [foto, setFoto] = useState<{ archivo: File; url: string } | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const campo = useRef<HTMLTextAreaElement>(null);
  const selectorFoto = useRef<HTMLInputElement>(null);

  // El campo crece con el texto hasta un máximo y después scrollea.
  useEffect(() => {
    const el = campo.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, ALTO_MAXIMO_PX)}px`;
  }, [texto]);

  useEffect(
    () => () => {
      if (foto) URL.revokeObjectURL(foto.url);
    },
    [foto],
  );

  if (bloqueo) {
    return (
      <p className="flex items-center justify-center gap-2 border-t bg-muted/60 px-4 py-4 text-center text-sm text-muted-foreground">
        <Lock className="size-4 shrink-0" aria-hidden="true" />
        {bloqueo}
      </p>
    );
  }

  async function enviar() {
    const contenido = texto.trim();
    if (!foto && !contenido) return;
    setAviso(null);
    // Se limpia al instante: el mensaje ya aparece en el hilo (y se puede reintentar si falla).
    setTexto("");
    if (foto) {
      const { archivo } = foto;
      setFoto(null);
      await onEnviarFoto(archivo, contenido);
    } else {
      await onEnviarTexto(contenido);
    }
    campo.current?.focus();
  }

  function elegirFoto(archivo: File | undefined) {
    if (!archivo) return;
    if (!archivo.type.startsWith("image/")) return setAviso("Elegí una imagen (JPG o PNG).");
    if (archivo.size > PESO_MAXIMO_FOTO) return setAviso("La foto es muy pesada (máximo 15 MB).");
    setAviso(null);
    setFoto({ archivo, url: URL.createObjectURL(archivo) });
    campo.current?.focus();
  }

  const puedeEnviar = Boolean(foto || texto.trim());

  return (
    <div className="border-t bg-card pb-[env(safe-area-inset-bottom)]">
      {foto ? (
        <div className="flex items-center gap-3 border-b px-3 py-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={foto.url}
            alt="Vista previa de la foto a enviar"
            className="size-16 rounded-md object-cover"
          />
          <p className="flex-1 text-sm text-muted-foreground">
            Agregá un texto si querés y tocá enviar. La foto se comprime antes de subir.
          </p>
          <Button type="button" variant="ghost" size="icon" onClick={() => setFoto(null)}>
            <X aria-hidden="true" />
            <span className="sr-only">Quitar la foto</span>
          </Button>
        </div>
      ) : null}
      <form
        className="flex items-end gap-1 px-2 py-2"
        onSubmit={(e) => {
          e.preventDefault();
          void enviar();
        }}
      >
        {acciones}
        {fotosHabilitadas ? (
          <>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => selectorFoto.current?.click()}
              title="Enviar una foto"
            >
              <ImagePlus aria-hidden="true" />
              <span className="sr-only">Enviar una foto</span>
            </Button>
            <input
              ref={selectorFoto}
              type="file"
              accept="image/*"
              aria-label="Seleccionar una foto"
              className="sr-only"
              tabIndex={-1}
              onChange={(e) => {
                elegirFoto(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
          </>
        ) : null}
        <label htmlFor={idCampo} className="sr-only">
          Mensaje
        </label>
        <textarea
          ref={campo}
          id={idCampo}
          rows={1}
          maxLength={LARGO_MAXIMO_MENSAJE}
          value={texto}
          placeholder={foto ? "Texto de la foto (opcional)" : "Escribí un mensaje"}
          onChange={(e) => {
            setTexto(e.target.value);
            onEscribiendo();
          }}
          onKeyDown={(e) => {
            // En escritorio Enter envía (Shift+Enter, salto de línea); en el celular, Enter es salto.
            const tactil = window.matchMedia("(pointer: coarse)").matches;
            if (e.key === "Enter" && !e.shiftKey && !tactil && !e.nativeEvent.isComposing) {
              e.preventDefault();
              void enviar();
            }
          }}
          className="max-h-40 min-h-11 flex-1 resize-none rounded-2xl border border-input bg-background px-4 py-2.5 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <Button type="submit" size="icon" disabled={!puedeEnviar} className="rounded-full">
          <SendHorizontal aria-hidden="true" />
          <span className="sr-only">Enviar</span>
        </Button>
      </form>
      {aviso ? (
        <p role="alert" className="px-4 pb-2 text-sm font-medium text-destructive">
          {aviso}
        </p>
      ) : !contactoVisible ? (
        <p className="px-4 pb-2 text-xs text-muted-foreground">
          Los teléfonos y emails se ocultan hasta que se confirme el flete: la coordinación es por acá.
        </p>
      ) : null}
    </div>
  );
}
