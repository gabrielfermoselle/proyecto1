"use client";

import { X } from "lucide-react";
import Image from "next/image";
import { useState } from "react";
import { quitarFotoSolicitud } from "../actions";
import { VisorFoto, type FotoVisible } from "./visor-foto";

interface Foto {
  id: string;
  url: string;
  ancho: number | null;
  alto: number | null;
}

/**
 * Miniaturas de fotos que se abren a pantalla completa al tocarlas. Si `editable`, cada una trae
 * su botón para quitarla. Sirve tanto para las fotos de un ítem como para las generales.
 */
export function GaleriaFotos({
  fotos,
  etiqueta,
  editable,
}: {
  fotos: Foto[];
  etiqueta: string;
  editable: boolean;
}) {
  const [visor, setVisor] = useState<FotoVisible | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (fotos.length === 0) return null;

  async function quitar(id: string) {
    const r = await quitarFotoSolicitud({ fotoId: id });
    if (!r.ok) setError(r.error);
  }

  return (
    <>
      <ul className="flex flex-wrap gap-2">
        {fotos.map((foto, i) => (
          <li key={foto.id} className="relative">
            <button
              type="button"
              onClick={() =>
                setVisor({
                  src: foto.url,
                  alt: `${etiqueta}, foto ${i + 1}`,
                  ancho: foto.ancho ?? 1200,
                  alto: foto.alto ?? 900,
                })
              }
              className="block overflow-hidden rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Image
                src={foto.url}
                alt={`Ver foto de ${etiqueta}`}
                width={96}
                height={72}
                unoptimized
                className="h-[72px] w-24 object-cover transition-transform hover:scale-105"
              />
            </button>
            {editable ? (
              <button
                type="button"
                onClick={() => void quitar(foto.id)}
                className="absolute -right-2 -top-2 grid size-7 place-items-center rounded-full border bg-card shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <X className="size-4" aria-hidden="true" />
                <span className="sr-only">
                  Quitar foto {i + 1} de {etiqueta}
                </span>
              </button>
            ) : null}
          </li>
        ))}
      </ul>
      {error ? (
        <p role="alert" className="text-sm font-medium text-destructive">
          {error}
        </p>
      ) : null}
      {visor ? <VisorFoto foto={visor} onClose={() => setVisor(null)} /> : null}
    </>
  );
}
