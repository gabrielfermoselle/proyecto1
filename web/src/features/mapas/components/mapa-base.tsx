"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { MapContainer, TileLayer } from "react-leaflet";
import type { Coordenadas } from "@/domain/geo";
import { cn } from "@/lib/utils";

export type VariantePin = "origen" | "destino" | "base" | "aprox" | "fletero";

const cachePines = new Map<VariantePin, L.DivIcon>();

/** Pin dibujado con CSS (ver globals.css): no depende de las imágenes de Leaflet. */
export function pin(variante: VariantePin = "origen"): L.DivIcon {
  const existente = cachePines.get(variante);
  if (existente) return existente;
  const icono = L.divIcon({
    className: "",
    html: `<span class="pin pin--${variante}"></span>`,
    iconSize: [26, 26],
    iconAnchor: [13, 26],
    popupAnchor: [0, -24],
  });
  cachePines.set(variante, icono);
  return icono;
}

interface MapaBaseProps {
  centro: Coordenadas;
  zoom?: number;
  className?: string;
  /** Descripción del mapa para lectores de pantalla. */
  etiqueta: string;
  children?: React.ReactNode;
}

export function MapaBase({ centro, zoom = 13, className, etiqueta, children }: MapaBaseProps) {
  return (
    <div role="region" aria-label={etiqueta} className={cn("overflow-hidden rounded-lg border", className)}>
      <MapContainer
        center={[centro.lat, centro.lng]}
        zoom={zoom}
        scrollWheelZoom={false}
        className="size-full"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {children}
      </MapContainer>
    </div>
  );
}
