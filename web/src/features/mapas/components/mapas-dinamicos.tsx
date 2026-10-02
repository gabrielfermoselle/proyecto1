"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";

// Leaflet necesita `window`: los mapas se cargan solo en el navegador, con un placeholder
// del mismo tamaño para que la página no salte al aparecer.

export const MapaZona = dynamic(() => import("./mapa-zona").then((m) => m.MapaZona), {
  ssr: false,
  loading: () => <Skeleton className="h-72 w-full sm:h-96" />,
});

export const MapaPuntos = dynamic(() => import("./mapa-puntos").then((m) => m.MapaPuntos), {
  ssr: false,
  loading: () => <Skeleton className="h-[60vh] min-h-80 w-full" />,
});

export const MapaPunto = dynamic(() => import("./mapa-punto").then((m) => m.MapaPunto), {
  ssr: false,
  loading: () => <Skeleton className="h-56 w-full sm:h-64" />,
});
