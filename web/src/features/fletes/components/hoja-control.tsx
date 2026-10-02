"use client";

import { Camera, X } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { RadioCard } from "@/components/shared/radio-card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { FaseControl, ResultadoControl } from "@/domain/catalogos";
import { LARGO_MINIMO_OBSERVACION, requiereObservacion } from "@/domain/ciclo-flete";
import { comprimirImagen, subirImagen } from "@/features/uploads/subir-imagen";
import { prepararFotoFlete, registrarControl } from "../actions";
import { OPCION_RESULTADO, OPCIONES_DETALLE } from "../presentacion";

const PESO_MAXIMO_FOTO = 15 * 1024 * 1024;

interface HojaControlProps {
  fleteId: string;
  fase: FaseControl;
  item: { id: string; nombre: string; cantidad: number };
  /** Control ya registrado (para corregirlo). */
  actual: { resultado: ResultadoControl; observacion: string | null } | null;
  fotosHabilitadas: boolean;
  trigger: (abrir: () => void) => React.ReactNode;
}

/**
 * Registro con detalle de un ítem: resultado, observación y una foto opcional. En el celular el
 * diálogo aparece desde abajo y la foto abre la cámara trasera (salvo en la recepción del
 * cliente, que suele tener la foto ya sacada).
 */
export function HojaControl({ fleteId, fase, item, actual, fotosHabilitadas, trigger }: HojaControlProps) {
  const opciones = OPCIONES_DETALLE[fase];
  const inicial = actual && opciones.includes(actual.resultado) ? actual.resultado : opciones[0]!;
  const [resultado, setResultado] = useState<ResultadoControl>(inicial);
  const [observacion, setObservacion] = useState(actual?.observacion ?? "");
  const [foto, setFoto] = useState<{ archivo: File; url: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const idObservacion = useId();
  const idFoto = useId();

  useEffect(
    () => () => {
      if (foto) URL.revokeObjectURL(foto.url);
    },
    [foto],
  );

  const obligatoria = requiereObservacion(resultado);
  const faltaObservacion = obligatoria && observacion.trim().length < LARGO_MINIMO_OBSERVACION;
  const opcion = OPCION_RESULTADO[resultado];

  async function subirFoto(archivo: File) {
    const preparada = await prepararFotoFlete({ fleteId });
    if (!preparada.ok) throw new Error(preparada.error);
    const imagen = await comprimirImagen(archivo);
    return subirImagen(imagen, preparada.data.subida, preparada.data.storage);
  }

  async function confirmar(): Promise<boolean> {
    setError(null);
    try {
      const subida = foto ? await subirFoto(foto.archivo) : null;
      const r = await registrarControl({
        fleteId,
        itemId: item.id,
        fase,
        resultado,
        observacion: observacion.trim() || null,
        foto: subida,
      });
      if (!r.ok) {
        setError(r.error);
        return false;
      }
      setFoto(null);
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "No pudimos guardar. Revisá tu conexión.");
      return false;
    }
  }

  return (
    <ConfirmDialog
      title={`${item.cantidad > 1 ? `${item.cantidad} × ` : ""}${item.nombre}`}
      description={opciones.length > 1 ? "¿Qué pasó con este ítem?" : opcion.descripcion}
      confirmLabel={resultado === "RECLAMO" ? "Abrir reclamo" : "Guardar"}
      variant={resultado === "RECLAMO" || resultado === "CON_DANO" ? "destructive" : "default"}
      confirmDisabled={faltaObservacion}
      onConfirm={confirmar}
      trigger={(abrir) =>
        trigger(() => {
          setError(null);
          abrir();
        })
      }
    >
      <div className="grid gap-4">
        {opciones.length > 1 ? (
          <fieldset className="grid gap-2">
            <legend className="sr-only">Resultado</legend>
            {opciones.map((r) => (
              <RadioCard
                key={r}
                name={`resultado-${item.id}`}
                value={r}
                checked={resultado === r}
                onChange={() => setResultado(r)}
                title={OPCION_RESULTADO[r].titulo}
                description={OPCION_RESULTADO[r].descripcion}
                className="p-3"
              />
            ))}
          </fieldset>
        ) : null}

        <div className="grid gap-2">
          <Label htmlFor={idObservacion}>
            {resultado === "RECLAMO" ? "¿Qué pasó?" : "Observación"}
            {obligatoria ? null : <span className="font-normal text-muted-foreground"> (opcional)</span>}
          </Label>
          <Textarea
            id={idObservacion}
            rows={3}
            maxLength={resultado === "RECLAMO" ? 500 : 300}
            value={observacion}
            onChange={(e) => setObservacion(e.target.value)}
            placeholder={opcion.placeholder}
            aria-invalid={faltaObservacion && observacion.length > 0 ? true : undefined}
          />
        </div>

        {fotosHabilitadas ? (
          <div className="grid gap-2">
            {foto ? (
              <div className="relative justify-self-start">
                {/* eslint-disable-next-line @next/next/no-img-element -- vista previa local (object URL) */}
                <img
                  src={foto.url}
                  alt="Foto elegida"
                  className="h-28 w-auto rounded-md border object-cover"
                />
                <button
                  type="button"
                  onClick={() => setFoto(null)}
                  className="absolute -right-2 -top-2 grid size-7 place-items-center rounded-full border bg-card shadow"
                >
                  <X className="size-4" aria-hidden="true" />
                  <span className="sr-only">Quitar la foto</span>
                </button>
              </div>
            ) : (
              <Button asChild variant="outline" className="justify-self-start">
                <label htmlFor={idFoto} className="cursor-pointer">
                  <Camera aria-hidden="true" />
                  {fase === "RECEPCION" ? "Agregar una foto" : "Sacar una foto"}
                </label>
              </Button>
            )}
            <input
              id={idFoto}
              type="file"
              accept="image/*"
              {...(fase === "RECEPCION" ? {} : { capture: "environment" as const })}
              className="sr-only"
              onChange={(e) => {
                const archivo = e.target.files?.[0];
                e.target.value = "";
                if (!archivo) return;
                if (archivo.size > PESO_MAXIMO_FOTO) {
                  setError("La foto es muy pesada (máximo 15 MB).");
                  return;
                }
                setFoto({ archivo, url: URL.createObjectURL(archivo) });
              }}
            />
          </div>
        ) : null}

        {error ? (
          <p role="alert" className="text-sm font-medium text-destructive">
            {error}
          </p>
        ) : null}
      </div>
    </ConfirmDialog>
  );
}
