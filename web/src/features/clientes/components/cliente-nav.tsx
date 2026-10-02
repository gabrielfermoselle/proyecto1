"use client";

import { LayoutDashboard, MessagesSquare } from "lucide-react";
import { NavInferior, NavTabs, type SeccionNav } from "@/components/shared/area-nav";
import { NoLeidosBadge } from "@/features/chat/components/no-leidos-badge";

// El módulo de clientes suma acá "Mis solicitudes" y "Buscar fleteros".
const secciones = (): SeccionNav[] => [
  { href: "/cliente", label: "Inicio", Icono: LayoutDashboard, prefijos: [], enInferior: true },
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
