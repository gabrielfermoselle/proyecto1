"use client";

import { ImagePlus, Loader2, X } from "lucide-react";
import Image from "next/image";
import { useId, useRef, useState } from "react";
import { subirImagen } from "@/features/uploads/subir-imagen";
import { agregarFotoVehiculo, eliminarFotoVehiculo, firmarSubidaFotoVehiculo } from "../actions";

interface Foto {
  id: string;
  url: string;
  ancho: number | null;
  alto: number | null;
}

interface FotosVehiculoProps {
  vehiculoId: string;
  descripcion: string;
  fotos: Foto[];
  habilitadas: boolean;
}

const MAX_FOTOS = 6;

export function FotosVehiculo({ vehiculoId, descripcion, fotos, habilitadas }: FotosVehiculoProps) {
  const inputId = useId();
  const input = useRef<HTMLInputElement>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!habilitadas) {
    return (
      <p className="flex items-center gap-2 rounded-md border border-dashed px-3 py-2 text-sm text-muted-foreground">
        <ImagePlus className="size-4 shrink-0" aria-hidden="true" />
        La carga de fotos se habilita cuando la plataforma configure el almacenamiento de imágenes.
      </p>
    );
  }

  async function onArchivos(archivos: FileList | null) {
    const lista = [...(archivos ?? [])].slice(0, MAX_FOTOS - fotos.length);
    if (lista.length === 0) return;
    setSubiendo(true);
    setError(null);
    try {
      for (const archivo of lista) {
        const firma = await firmarSubidaFotoVehiculo({ vehiculoId });
        if (!firma.ok) throw new Error(firma.error);
        const subida = await subirImagen(archivo, firma.data);
        const guardada = await agregarFotoVehiculo({ vehiculoId, ...subida });
        if (!guardada.ok) throw new Error(guardada.error);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo subir la foto.");
    } finally {
      setSubiendo(false);
      if (input.current) input.current.value = "";
    }
  }

  async function quitar(fotoId: string) {
    const resultado = await eliminarFotoVehiculo({ fotoId });
    if (!resultado.ok) setError(resultado.error);
  }

  return (
    <div className="grid gap-2">
      <ul className="flex flex-wrap gap-2">
        {fotos.map((foto, i) => (
          <li key={foto.id} className="relative">
            <Image
              src={foto.url}
              alt={`${descripcion}, foto ${i + 1}`}
              width={96}
              height={72}
              className="h-[72px] w-24 rounded-md object-cover"
            />
            <button
              type="button"
              onClick={() => quitar(foto.id)}
              className="absolute -right-2 -top-2 grid size-7 place-items-center rounded-full border bg-card shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <X className="size-4" aria-hidden="true" />
              <span className="sr-only">Quitar foto {i + 1}</span>
            </button>
          </li>
        ))}
        {fotos.length < MAX_FOTOS ? (
          <li>
            <label
              htmlFor={inputId}
              className="flex h-[72px] w-24 cursor-pointer flex-col items-center justify-center gap-1 rounded-md border-2 border-dashed text-xs font-semibold text-muted-foreground hover:border-primary/50 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring"
            >
              {subiendo ? (
                <Loader2 className="size-5 animate-spin" aria-hidden="true" />
              ) : (
                <ImagePlus className="size-5" aria-hidden="true" />
              )}
              {subiendo ? "Subiendo…" : "Agregar"}
              <input
                ref={input}
                id={inputId}
                type="file"
                accept="image/*"
                multiple
                className="sr-only"
                disabled={subiendo}
                onChange={(e) => onArchivos(e.target.files)}
              />
            </label>
          </li>
        ) : null}
      </ul>
      {error ? (
        <p role="alert" className="text-sm font-medium text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
