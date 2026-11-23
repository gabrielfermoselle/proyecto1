"use client";

import { Camera, ImagePlus, Loader2, RefreshCw } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { MAXIMO_FOTOS_SOLICITUD } from "@/domain/solicitud";
import { comprimirImagen, subirImagen } from "@/features/uploads/subir-imagen";
import { agregarFotoSolicitud, prepararFotoSolicitud } from "../actions";

/**
 * Botones para sumar una foto a un ítem (o general, con `itemId` nulo): sacarla con la cámara o
 * elegirla de la galería. Si ya hay fotos, primero muestra "Cambiar foto" y al tocarlo despliega
 * las dos opciones. Las miniaturas se muestran aparte (ver `GaleriaFotos`); el tope de fotos
 * (`total`) es el de toda la solicitud.
 */
export function SubirFoto({
  solicitudId,
  itemId,
  etiqueta,
  total,
  tieneFotos,
}: {
  solicitudId: string;
  itemId: string | null;
  etiqueta: string;
  total: number;
  tieneFotos: boolean;
}) {
  const inputId = useId();
  const camaraId = useId();
  const input = useRef<HTMLInputElement>(null);
  const camara = useRef<HTMLInputElement>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hayCamara, setHayCamara] = useState(false);
  const [abierto, setAbierto] = useState(false);

  useEffect(() => {
    let activo = true;
    navigator.mediaDevices
      ?.enumerateDevices?.()
      .then((dispositivos) => {
        if (activo) setHayCamara(dispositivos.some((d) => d.kind === "videoinput"));
      })
      .catch(() => {});
    return () => {
      activo = false;
    };
  }, []);

  async function subir(archivos: FileList | null) {
    const lista = [...(archivos ?? [])].slice(0, MAXIMO_FOTOS_SOLICITUD - total);
    if (lista.length === 0) return;
    setSubiendo(true);
    setError(null);
    try {
      for (const archivo of lista) {
        const preparada = await prepararFotoSolicitud({ solicitudId });
        if (!preparada.ok) throw new Error(preparada.error);
        const subida = await subirImagen(await comprimirImagen(archivo), preparada.data);
        const r = await agregarFotoSolicitud({ solicitudId, itemId, ...subida });
        if (!r.ok) throw new Error(r.error);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo subir la foto.");
    } finally {
      setSubiendo(false);
      setAbierto(false);
      if (input.current) input.current.value = "";
      if (camara.current) camara.current.value = "";
    }
  }

  if (total >= MAXIMO_FOTOS_SOLICITUD) return null;

  const cuadrado =
    "inline-flex h-[72px] w-24 shrink-0 cursor-pointer flex-col items-center justify-center gap-1 rounded-md border-2 border-dashed text-xs font-semibold text-muted-foreground hover:border-primary/50 hover:text-foreground has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring";

  // Con fotos ya cargadas, primero "Cambiar foto"; recién al tocarlo aparecen las dos opciones.
  if (tieneFotos && !abierto) {
    return (
      <button type="button" onClick={() => setAbierto(true)} className={cuadrado}>
        <RefreshCw className="size-5" aria-hidden="true" />
        Cambiar foto
        <span className="sr-only">de {etiqueta}</span>
      </button>
    );
  }

  return (
    <div className="grid gap-1.5">
      <div className="flex gap-2">
        {hayCamara ? (
          <label htmlFor={camaraId} className={cuadrado}>
            {subiendo ? (
              <Loader2 className="size-5 animate-spin" aria-hidden="true" />
            ) : (
              <Camera className="size-5" aria-hidden="true" />
            )}
            Sacar foto
            <span className="sr-only">de {etiqueta}</span>
            <input
              ref={camara}
              id={camaraId}
              type="file"
              accept="image/*"
              capture="environment"
              className="sr-only"
              disabled={subiendo}
              onChange={(e) => void subir(e.target.files)}
            />
          </label>
        ) : null}
        <label htmlFor={inputId} className={cuadrado}>
          {subiendo ? (
            <Loader2 className="size-5 animate-spin" aria-hidden="true" />
          ) : (
            <ImagePlus className="size-5" aria-hidden="true" />
          )}
          {hayCamara ? "Elegir" : "Agregar"}
          <span className="sr-only">foto de {etiqueta}</span>
          <input
            ref={input}
            id={inputId}
            type="file"
            accept="image/*"
            multiple
            className="sr-only"
            disabled={subiendo}
            onChange={(e) => void subir(e.target.files)}
          />
        </label>
      </div>
      {error ? (
        <p role="alert" className="text-sm font-medium text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
