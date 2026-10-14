"use client";

import { BriefcaseBusiness, Inbox, Truck } from "lucide-react";
// [FUERA-S3] [FE] Pantalla del chat: import { MessagesSquare } from "lucide-react";
import { NavInferior, NavTabs, type SeccionNav } from "@/components/shared/area-nav";
// [FUERA-S3] [FE] Pantalla del chat
// import { NoLeidosBadge } from "@/features/chat/components/no-leidos-badge";

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
  // [FUERA-S3] [FE] Pantalla del chat
  // {
  //   href: "/chat",
  //   label: "Chat",
  //   Icono: MessagesSquare,
  //   prefijos: ["/chat"],
  //   enInferior: true,
  //   extra: <NoLeidosBadge />,
  // },
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
