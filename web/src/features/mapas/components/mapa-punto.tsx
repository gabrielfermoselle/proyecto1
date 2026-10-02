"use client";

import type L from "leaflet";
import { useEffect, useMemo } from "react";
import { Marker, useMap, useMapEvents } from "react-leaflet";
import { CENTRO_TUCUMAN, type Coordenadas } from "@/domain/geo";
import { MapaBase, pin, type VariantePin } from "./mapa-base";

interface MapaPuntoProps {
  punto: Coordenadas | null;
  onMover: (punto: Coordenadas) => void;
  variante?: VariantePin;
  etiqueta: string;
}

function Centrar({ punto }: { punto: Coordenadas | null }) {
  const mapa = useMap();
  useEffect(() => {
    if (punto) mapa.setView([punto.lat, punto.lng], Math.max(mapa.getZoom(), 15), { animate: true });
  }, [mapa, punto]);
  return null;
}

function TocarParaMover({ onMover }: { onMover: (punto: Coordenadas) => void }) {
  useMapEvents({ click: (e) => onMover({ lat: e.latlng.lat, lng: e.latlng.lng }) });
  return null;
}

/** Elegir un punto exacto: tocar el mapa o arrastrar el pin. */
export function MapaPunto({ punto, onMover, variante = "origen", etiqueta }: MapaPuntoProps) {
  const handlers = useMemo(
    () => ({
      dragend: (e: L.LeafletEvent) => {
        const { lat, lng } = (e.target as L.Marker).getLatLng();
        onMover({ lat, lng });
      },
    }),
    [onMover],
  );
  return (
    <MapaBase
      centro={punto ?? CENTRO_TUCUMAN}
      zoom={punto ? 15 : 12}
      etiqueta={etiqueta}
      className="h-56 sm:h-64"
    >
      <TocarParaMover onMover={onMover} />
      <Centrar punto={punto} />
      {punto ? (
        <Marker position={[punto.lat, punto.lng]} icon={pin(variante)} draggable eventHandlers={handlers} />
      ) : null}
    </MapaBase>
  );
}
