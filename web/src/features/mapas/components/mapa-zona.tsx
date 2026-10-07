"use client";

import L from "leaflet";
import { useEffect, useMemo } from "react";
import { Circle, Marker, useMap, useMapEvents } from "react-leaflet";
import { CENTRO_TUCUMAN, type Coordenadas } from "@/domain/geo";
import { MapaBase, pin } from "./mapa-base";

interface MapaZonaProps {
  punto: Coordenadas | null;
  radioKm: number;
  onMover: (punto: Coordenadas) => void;
}

/** Ajusta la vista para que se vea todo el círculo de cobertura. */
function AjustarVista({ punto, radioKm }: { punto: Coordenadas | null; radioKm: number }) {
  const mapa = useMap();
  useEffect(() => {
    if (!punto) return;
    mapa.fitBounds(L.latLng(punto.lat, punto.lng).toBounds(radioKm * 2000), {
      padding: [16, 16],
      animate: true,
    });
  }, [mapa, punto, radioKm]);
  return null;
}

function TocarParaMover({ onMover }: { onMover: (punto: Coordenadas) => void }) {
  useMapEvents({ click: (e) => onMover({ lat: e.latlng.lat, lng: e.latlng.lng }) });
  return null;
}

/** Elegir el punto base: tocar el mapa o arrastrar el pin. El círculo muestra la cobertura. */
export function MapaZona({ punto, radioKm, onMover }: MapaZonaProps) {
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
      zoom={12}
      etiqueta="Mapa para elegir tu punto base. Tocá el mapa o arrastrá el pin."
      className="h-72 sm:h-96"
    >
      <TocarParaMover onMover={onMover} />
      <AjustarVista punto={punto} radioKm={radioKm} />
      {punto ? (
        <>
          <Marker
            position={[punto.lat, punto.lng]}
            icon={pin("base")}
            title="Tu punto base. Arrastralo para moverlo."
            draggable
            eventHandlers={handlers}
          />
          <Circle
            center={[punto.lat, punto.lng]}
            radius={radioKm * 1000}
            pathOptions={{ color: "hsl(160 37% 17%)", weight: 2, fillOpacity: 0.12 }}
          />
        </>
      ) : null}
    </MapaBase>
  );
}
