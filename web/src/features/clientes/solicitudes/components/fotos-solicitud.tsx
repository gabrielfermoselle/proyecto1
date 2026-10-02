"use client";

import { ImagePlus, Loader2, X } from "lucide-react";
import Image from "next/image";
import { useId, useRef, useState } from "react";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { MAXIMO_FOTOS_SOLICITUD } from "@/domain/solicitud";
import { comprimirImagen, subirImagen } from "@/features/uploads/subir-imagen";
import { agregarFotoSolicitud, prepararFotoSolicitud, quitarFotoSolicitud } from "../actions";

interface Foto {
  id: string;
  url: string;
  ancho: number | null;
  alto: number | null;
}

interface FotosSolicitudProps {
  solicitudId: string;
  general: Foto[];
  items: { id: string; nombre: string; fotos: Foto[] }[];
  habilitadas: boolean;
}

/** Fotos de la solicitud o de cada ítem. Le sirven al fletero para presupuestar mejor. */
export function FotosSolicitud({ solicitudId, general, items, habilitadas }: FotosSolicitudProps) {
  const inputId = useId();
  const selectId = useId();
  const input = useRef<HTMLInputElement>(null);
  const [destino, setDestino] = useState("");
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const total = general.length + items.reduce((n, i) => n + i.fotos.length, 0);
  const grupos = [
    { id: "", nombre: "Generales", fotos: general },
    ...items.filter((i) => i.fotos.length > 0),
  ].filter((g) => g.fotos.length > 0);

  if (!habilitadas) {
    return (
      <p className="flex items-center gap-2 rounded-md border border-dashed px-3 py-2 text-sm text-muted-foreground">
        <ImagePlus className="size-4 shrink-0" aria-hidden="true" />
        La carga de fotos se habilita cuando la plataforma configure el almacenamiento de imágenes.
      </p>
    );
  }

  async function subir(archivos: FileList | null) {
    const lista = [...(archivos ?? [])].slice(0, MAXIMO_FOTOS_SOLICITUD - total);
    if (lista.length === 0) return;
    setSubiendo(true);
    setError(null);
    try {
      for (const archivo of lista) {
        const preparada = await prepararFotoSolicitud({ solicitudId });
        if (!preparada.ok) throw new Error(preparada.error);
        const subida = await subirImagen(
          await comprimirImagen(archivo),
          preparada.data.subida,
          preparada.data.storage,
        );
        const r = await agregarFotoSolicitud({ solicitudId, itemId: destino || null, ...subida });
        if (!r.ok) throw new Error(r.error);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo subir la foto.");
    } finally {
      setSubiendo(false);
      if (input.current) input.current.value = "";
    }
  }

  async function quitar(fotoId: string) {
    const r = await quitarFotoSolicitud({ fotoId });
    if (!r.ok) setError(r.error);
  }

  return (
    <div className="grid gap-4">
      {grupos.map((g) => (
        <div key={g.id || "general"} className="grid gap-2">
          <p className="text-sm font-semibold text-muted-foreground">{g.nombre}</p>
          <ul className="flex flex-wrap gap-2">
            {g.fotos.map((foto, i) => (
              <li key={foto.id} className="relative">
                <Image
                  src={foto.url}
                  alt={`${g.nombre}, foto ${i + 1}`}
                  width={112}
                  height={84}
                  className="h-[84px] w-28 rounded-md object-cover"
                />
                <button
                  type="button"
                  onClick={() => quitar(foto.id)}
                  className="absolute -right-2 -top-2 grid size-7 place-items-center rounded-full border bg-card shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <X className="size-4" aria-hidden="true" />
                  <span className="sr-only">
                    Quitar foto {i + 1} de {g.nombre}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ))}
      {total < MAXIMO_FOTOS_SOLICITUD ? (
        <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
          <div className="grid gap-2">
            <Label htmlFor={selectId}>¿De qué es la foto?</Label>
            <Select id={selectId} value={destino} onChange={(e) => setDestino(e.target.value)}>
              <option value="">General (el lugar, el acceso…)</option>
              {items.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.nombre}
                </option>
              ))}
            </Select>
          </div>
          <label
            htmlFor={inputId}
            className="inline-flex h-11 cursor-pointer items-center justify-center gap-2 rounded-md border-2 border-dashed px-4 font-semibold hover:border-primary/50 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring"
          >
            {subiendo ? (
              <Loader2 className="size-5 animate-spin" aria-hidden="true" />
            ) : (
              <ImagePlus className="size-5" aria-hidden="true" />
            )}
            {subiendo ? "Subiendo…" : "Agregar fotos"}
            <input
              ref={input}
              id={inputId}
              type="file"
              accept="image/*"
              multiple
              className="sr-only"
              disabled={subiendo}
              onChange={(e) => subir(e.target.files)}
            />
          </label>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Llegaste al máximo de {MAXIMO_FOTOS_SOLICITUD} fotos.</p>
      )}
      {error ? (
        <p role="alert" className="text-sm font-medium text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
