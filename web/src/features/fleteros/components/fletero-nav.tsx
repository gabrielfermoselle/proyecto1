"use client";

import { CalendarDays, FileText, Inbox, LayoutDashboard, MessagesSquare, UserRound } from "lucide-react";
import { NavInferior, NavTabs, type SeccionNav } from "@/components/shared/area-nav";
import { NoLeidosBadge } from "@/features/chat/components/no-leidos-badge";

const secciones = (): SeccionNav[] => [
  { href: "/fletero", label: "Inicio", Icono: LayoutDashboard, prefijos: [], enInferior: true },
  {
    href: "/fletero/solicitudes",
    label: "Solicitudes",
    Icono: Inbox,
    prefijos: ["/fletero/solicitudes"],
    enInferior: true,
  },
  {
    href: "/fletero/mensajes",
    label: "Mensajes",
    Icono: MessagesSquare,
    prefijos: ["/fletero/mensajes"],
    enInferior: true,
    extra: <NoLeidosBadge />,
  },
  {
    href: "/fletero/agenda",
    label: "Agenda",
    Icono: CalendarDays,
    prefijos: ["/fletero/agenda", "/fletero/fletes"],
    enInferior: true,
  },
  // En el celular se llega desde Solicitudes → Presupuestadas y desde el panel.
  {
    href: "/fletero/presupuestos",
    label: "Presupuestos",
    Icono: FileText,
    prefijos: ["/fletero/presupuestos"],
    enInferior: false,
  },
  {
    href: "/fletero/perfil",
    label: "Perfil",
    Icono: UserRound,
    prefijos: ["/fletero/perfil"],
    enInferior: true,
  },
];

export function FleteroNavTabs() {
  return <NavTabs secciones={secciones()} />;
}

export function FleteroNavInferior() {
  return <NavInferior secciones={secciones()} ocultarEn={/^\/fletero\/mensajes\/[^/]+/} />;
}
