"use client";

import { ClipboardList, LayoutDashboard, MessageSquareWarning, Users } from "lucide-react";
import { NavInferior, NavTabs, type SeccionNav } from "@/components/shared/area-nav";

const secciones = (): SeccionNav[] => [
  { href: "/admin", label: "Resumen", Icono: LayoutDashboard, prefijos: [], enInferior: true },
  {
    href: "/admin/usuarios",
    label: "Usuarios",
    Icono: Users,
    prefijos: ["/admin/usuarios"],
    enInferior: true,
  },
  {
    href: "/admin/reclamos",
    label: "Reclamos",
    Icono: MessageSquareWarning,
    prefijos: ["/admin/reclamos"],
    enInferior: true,
  },
  {
    href: "/admin/solicitudes",
    label: "Solicitudes",
    Icono: ClipboardList,
    prefijos: ["/admin/solicitudes"],
    enInferior: true,
  },
];

export function AdminNavTabs() {
  return <NavTabs secciones={secciones()} />;
}

export function AdminNavInferior() {
  return <NavInferior secciones={secciones()} />;
}
