"use client";

import { X } from "lucide-react";
import Image from "next/image";
import { useEffect, useRef } from "react";

export interface FotoVisible {
  src: string;
  alt: string;
  ancho: number;
  alto: number;
}

/** Abre una foto a pantalla completa. Se cierra con el botón, tocando el fondo o con Escape. */
export function VisorFoto({ foto, onClose }: { foto: FotoVisible; onClose: () => void }) {
  const cerrar = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    // Bloquea el scroll del fondo mientras la foto está abierta.
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    cerrar.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={foto.alt}
      className="fixed inset-0 z-50 grid place-items-center bg-black/85 p-4"
      onClick={onClose}
    >
      <button
        ref={cerrar}
        type="button"
        onClick={onClose}
        className="absolute right-4 top-[max(1rem,env(safe-area-inset-top))] grid size-12 place-items-center rounded-full bg-white/15 text-white backdrop-blur transition-colors hover:bg-white/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
      >
        <X className="size-6" aria-hidden="true" />
        <span className="sr-only">Cerrar foto</span>
      </button>
      <Image
        src={foto.src}
        alt={foto.alt}
        width={foto.ancho}
        height={foto.alto}
        unoptimized
        onClick={(e) => e.stopPropagation()}
        className="h-auto max-h-[85vh] w-auto max-w-full rounded-lg object-contain"
      />
    </div>
  );
}
