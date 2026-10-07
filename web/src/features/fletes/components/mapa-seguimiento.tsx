"use client";

import { useMemo } from "react";
import type { PuntoMapa } from "@/features/mapas/components/mapa-puntos";
import { MapaPuntos } from "@/features/mapas/components/mapas-dinamicos";
import { formatearHora } from "@/lib/formato";

interface Lugar {
  direccion: string;
  lat: number;
  lng: number;
}

/** Origen, destino y, mientras el fletero está en la calle, la última ubicación que compartió. */
export function MapaSeguimiento({
  origen,
  destino,
  ultimaUbicacion,
}: {
  origen: Lugar;
  destino: Lugar;
  ultimaUbicacion: { lat: number; lng: number; fecha: Date } | null;
}) {
  const momento = ultimaUbicacion?.fecha.getTime() ?? null;
  // Memo por valor: el mapa se re-encuadra cada vez que cambian los puntos.
  const puntos = useMemo<PuntoMapa[]>(
    () => [
      {
        id: "origen",
        titulo: "Retiro",
        detalle: origen.direccion,
        variante: "origen",
        lat: origen.lat,
        lng: origen.lng,
      },
      {
        id: "destino",
        titulo: "Entrega",
        detalle: destino.direccion,
        variante: "destino",
        lat: destino.lat,
        lng: destino.lng,
      },
      ...(ultimaUbicacion && momento !== null
        ? [
            {
              id: "fletero",
              titulo: "Fletero",
              detalle: `Ubicación compartida a las ${formatearHora(new Date(momento))}`,
              variante: "fletero" as const,
              lat: ultimaUbicacion.lat,
              lng: ultimaUbicacion.lng,
            },
          ]
        : []),
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps -- se compara por valor, no por identidad
    [
      origen.lat,
      origen.lng,
      origen.direccion,
      destino.lat,
      destino.lng,
      destino.direccion,
      ultimaUbicacion?.lat,
      ultimaUbicacion?.lng,
      momento,
    ],
  );
  return (
    <MapaPuntos
      puntos={puntos}
      etiqueta="Mapa del flete: retiro, entrega y ubicación del fletero"
      className="h-72 sm:h-80"
    />
  );
}
