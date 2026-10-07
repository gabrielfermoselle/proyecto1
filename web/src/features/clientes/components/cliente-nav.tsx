"use client";

import { ClipboardList, MessagesSquare, Search, Truck, UserRound } from "lucide-react";
import { NavInferior, NavTabs, type SeccionNav } from "@/components/shared/area-nav";
import { NoLeidosBadge } from "@/features/chat/components/no-leidos-badge";

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
    href: "/cliente/solicitudes",
    label: "Solicitudes",
    Icono: ClipboardList,
    prefijos: ["/cliente/solicitudes"],
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
  {
    href: "/cliente/fleteros",
    label: "Fleteros",
    Icono: Search,
    prefijos: ["/cliente/fleteros"],
    enInferior: true,
  },
  {
    href: "/cliente/perfil",
    label: "Perfil",
    Icono: UserRound,
    prefijos: ["/cliente/perfil"],
    enInferior: true,
  },
];

export function ClienteNavTabs() {
  return <NavTabs secciones={secciones()} />;
}

export function ClienteNavInferior() {
  return <NavInferior secciones={secciones()} ocultarEn={/^\/cliente\/mensajes\/[^/]+/} />;
}
