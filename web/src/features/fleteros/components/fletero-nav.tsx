"use client";

import { BriefcaseBusiness, Inbox, MessagesSquare, Truck } from "lucide-react";
import { NavInferior, NavTabs, type SeccionNav } from "@/components/shared/area-nav";
import { NoLeidosBadge } from "@/features/chat/components/no-leidos-badge";

const secciones = (): SeccionNav[] => [
  {
    href: "/fletero",
    label: "Pedidos disponibles",
    labelCorto: "Disponibles",
    Icono: Inbox,
    prefijos: ["/fletero/pedido"],
    enInferior: true,
  },
  {
    href: "/fletero/trabajos",
    label: "Mis trabajos",
    labelCorto: "Trabajos",
    Icono: BriefcaseBusiness,
    prefijos: ["/fletero/trabajos"],
    enInferior: true,
  },
  {
    href: "/chat",
    label: "Chat",
    Icono: MessagesSquare,
    prefijos: ["/chat"],
    enInferior: true,
    extra: <NoLeidosBadge />,
  },
  {
    href: "/fletero/perfil",
    label: "Vehículo y zona",
    labelCorto: "Perfil",
    Icono: Truck,
    prefijos: ["/fletero/perfil"],
    enInferior: true,
  },
];

export function FleteroNavTabs() {
  return <NavTabs secciones={secciones()} />;
}

export function FleteroNavInferior() {
  return <NavInferior secciones={secciones()} ocultarEn={/^\/chat\/[^/]+/} />;
}
