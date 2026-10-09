"use client";

import { MapPin } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Button } from "@/components/ui/button";
import type { EtapaFlete } from "@/domain/catalogos";
import {
  ACCION_HACIA,
  CONFORMIDAD_DE_ETAPA,
  siguienteEtapa,
  textoConformidad,
  validarTransicion,
  type Actor,
  type ResumenInventario,
} from "@/domain/ciclo-flete";
import { obtenerPosicion } from "@/lib/geolocalizacion";
import { avanzarEtapa } from "../actions";

const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

function descripcion(hacia: EtapaFlete, r: ResumenInventario): string {
  switch (hacia) {
    case "EN_CAMINO_A_ORIGEN":
      return "Le avisamos al cliente que saliste a buscar la carga.";
    case "CARGANDO":
      return "Le avisamos al cliente que llegaste. Después marcá cada ítem a medida que lo cargás.";
    case "EN_TRASLADO":
      return (
        `Cargaste ${plural(r.cargados, "ítem", "ítems")}` +
        (r.noCargados ? ` (${plural(r.noCargados, "quedó sin cargar", "quedaron sin cargar")})` : "") +
        ". Le avisamos al cliente que vas al destino."
      );
    case "DESCARGANDO":
      return "Le avisamos al cliente que llegaste al destino. Después marcá cada ítem a medida que lo bajás.";
    case "ENTREGADO":
      return "El cliente va a revisar lo que recibió y cerrar el flete.";
    case "CERRADO":
      return "Con esto el flete queda cerrado y podés calificar al fletero.";
    default:
      return "";
  }
}

interface AccionEtapaProps {
  fleteId: string;
  etapa: EtapaFlete;
  rol: Actor;
  resumen: ResumenInventario;
}

/**
 * El botón principal de la etapa, fijo abajo en el celular. Avisa qué falta antes de habilitarse,
 * pide la firma de conformidad cuando corresponde y, para el fletero, comparte su ubicación.
 */
export function AccionEtapa({ fleteId, etapa, rol, resumen }: AccionEtapaProps) {
  const router = useRouter();
  const [firmado, setFirmado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [estado, setEstado] = useState<string | null>(null);
  const idFirma = useId();

  const siguiente = siguienteEtapa(etapa, rol) as EtapaFlete | null;
  if (!siguiente) return null;
  const pideFirma = CONFORMIDAD_DE_ETAPA[siguiente] === rol;
  // Lo que falta, sin contar la firma (que se pide en el diálogo).
  const previa = validarTransicion(etapa, siguiente, rol, {
    inventario: resumen,
    conformidad: true,
    motivo: null,
  });

  async function confirmar(): Promise<boolean> {
    setError(null);
    let ubicacion = null;
    if (rol === "FLETERO") {
      setEstado("Obteniendo tu ubicación…");
      ubicacion = await obtenerPosicion();
    }
    setEstado(null);
    const r = await avanzarEtapa({
      fleteId,
      hacia: siguiente!,
      ubicacion,
      conformidad: pideFirma ? firmado : false,
    });
    if (!r.ok) {
      setError(r.error);
      return false;
    }
    setFirmado(false);
    router.refresh();
    return true;
  }

  return (
    <div className="sticky bottom-[calc(4rem+env(safe-area-inset-bottom))] z-20 -mx-4 grid gap-2 border-t bg-background/95 px-4 py-3 backdrop-blur lg:bottom-0 lg:mx-0 lg:rounded-xl lg:border">
      {!previa.ok ? <p className="text-sm font-medium text-muted-foreground">{previa.motivo}</p> : null}
      <ConfirmDialog
        title={`${ACCION_HACIA[siguiente] ?? "Confirmar"}`}
        description={descripcion(siguiente, resumen)}
        confirmLabel={pideFirma ? "Firmar y confirmar" : "Sí, confirmar"}
        confirmDisabled={pideFirma && !firmado}
        onConfirm={confirmar}
        trigger={(abrir) => (
          <Button
            type="button"
            size="lg"
            className="w-full"
            disabled={!previa.ok}
            onClick={() => {
              setError(null);
              abrir();
            }}
          >
            {ACCION_HACIA[siguiente]}
          </Button>
        )}
      >
        <div className="grid gap-3">
          {pideFirma ? (
            <div className="grid gap-3 rounded-md border bg-muted/40 p-3">
              <p className="text-sm">{textoConformidad(rol, resumen)}</p>
              <label htmlFor={idFirma} className="flex cursor-pointer items-start gap-3 font-semibold">
                <input
                  id={idFirma}
                  type="checkbox"
                  checked={firmado}
                  onChange={(e) => setFirmado(e.target.checked)}
                  className="mt-0.5 size-5 shrink-0 accent-[hsl(var(--primary))]"
                />
                Firmo la conformidad
              </label>
              <p className="text-xs text-muted-foreground">
                Queda registrada con tu nombre, la fecha y la hora.
              </p>
            </div>
          ) : null}
          {rol === "FLETERO" ? (
            <p className="flex items-start gap-2 text-sm text-muted-foreground">
              <MapPin className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              Compartimos tu ubicación actual con el cliente, si tu navegador lo permite. Si no, la etapa
              avanza igual.
            </p>
          ) : null}
          {estado ? (
            <p className="text-sm font-medium" aria-live="polite">
              {estado}
            </p>
          ) : null}
          {error ? (
            <p role="alert" className="text-sm font-medium text-destructive">
              {error}
            </p>
          ) : null}
        </div>
      </ConfirmDialog>
    </div>
  );
}
