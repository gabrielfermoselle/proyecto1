"use client";

import { MessagesSquare, Truck } from "lucide-react";
import { NavInferior, NavTabs, type SeccionNav } from "@/components/shared/area-nav";
import { NoLeidosBadge } from "@/features/chat/components/no-leidos-badge";

// El módulo de clientes suma acá "Mis solicitudes" y "Buscar fleteros".
const secciones = (): SeccionNav[] => [
  {
    href: "/cliente",
    label: "Mis fletes",
    Icono: Truck,
    // "/cliente" exacto y el seguimiento de cada flete.
    prefijos: ["/cliente/fletes"],
    enInferior: true,
  },
  {
    href: "/cliente/mensajes",
    label: "Mensajes",
    Icono: MessagesSquare,
    prefijos: ["/cliente/mensajes"],
    enInferior: true,
    extra: <NoLeidosBadge />,
  },
];

export function ClienteNavTabs() {
  return <NavTabs secciones={secciones()} />;
}

export function ClienteNavInferior() {
  return <NavInferior secciones={secciones()} ocultarEn={/^\/cliente\/mensajes\/[^/]+/} />;
}
