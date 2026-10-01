"use client";

import L from "leaflet";
import Link from "next/link";
import { useEffect } from "react";
import { Circle, Marker, Popup, useMap } from "react-leaflet";
import { CENTRO_TUCUMAN, type Coordenadas } from "@/domain/geo";
import { MapaBase, pin, type VariantePin } from "./mapa-base";

export interface PuntoMapa extends Coordenadas {
  id: string;
  titulo: string;
  detalle?: string;
  href?: string;
  variante?: VariantePin;
}

interface MapaPuntosProps {
  puntos: PuntoMapa[];
  base?: Coordenadas | null;
  radioKm?: number;
  /** Texto del pin de la base (por defecto, "Tu base"). */
  etiquetaBase?: string;
  etiqueta: string;
  className?: string;
}

/** Encuadra todos los puntos (y el círculo de cobertura, si hay). */
function Encuadrar({ puntos, base, radioKm }: Pick<MapaPuntosProps, "puntos" | "base" | "radioKm">) {
  const mapa = useMap();
  useEffect(() => {
    const limites = L.latLngBounds([]);
    for (const p of puntos) limites.extend([p.lat, p.lng]);
    if (base)
      limites.extend(
        radioKm ? L.latLng(base.lat, base.lng).toBounds(radioKm * 2000) : L.latLng(base.lat, base.lng),
      );
    if (limites.isValid()) mapa.fitBounds(limites, { padding: [24, 24], maxZoom: 15 });
  }, [mapa, puntos, base, radioKm]);
  return null;
}

export function MapaPuntos({
  puntos,
  base,
  radioKm,
  etiquetaBase = "Tu base",
  etiqueta,
  className,
}: MapaPuntosProps) {
  return (
    <MapaBase
      centro={base ?? puntos[0] ?? CENTRO_TUCUMAN}
      etiqueta={etiqueta}
      className={className ?? "h-[60vh] min-h-80"}
    >
      <Encuadrar puntos={puntos} base={base ?? null} {...(radioKm ? { radioKm } : {})} />
      {base ? (
        <>
          <Marker position={[base.lat, base.lng]} icon={pin("base")}>
            <Popup>{etiquetaBase}</Popup>
          </Marker>
          {radioKm ? (
            <Circle
              center={[base.lat, base.lng]}
              radius={radioKm * 1000}
              pathOptions={{ color: "hsl(160 37% 17%)", weight: 1.5, fillOpacity: 0.06 }}
            />
          ) : null}
        </>
      ) : null}
      {puntos.map((p) => (
        <Marker key={p.id} position={[p.lat, p.lng]} icon={pin(p.variante ?? "origen")} title={p.titulo}>
          <Popup>
            <div className="grid gap-1 font-sans">
              <strong>{p.titulo}</strong>
              {p.detalle ? <span>{p.detalle}</span> : null}
              {p.href ? (
                <Link href={p.href} className="font-semibold text-primary underline underline-offset-2">
                  Ver detalle
                </Link>
              ) : null}
            </div>
          </Popup>
        </Marker>
      ))}
    </MapaBase>
  );
}
