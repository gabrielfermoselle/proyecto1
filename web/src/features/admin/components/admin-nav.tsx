"use client";

import { BadgeCheck, Flag } from "lucide-react";
import { NavInferior, NavTabs, type SeccionNav } from "@/components/shared/area-nav";

const secciones = (): SeccionNav[] => [
  {
    href: "/admin/fleteros",
    label: "Fleteros",
    Icono: BadgeCheck,
    prefijos: ["/admin/fleteros"],
    enInferior: true,
  },
  {
    href: "/admin/reportes",
    label: "Reportes",
    Icono: Flag,
    prefijos: ["/admin/reportes"],
    enInferior: true,
  },
];

export function AdminNavTabs() {
  return <NavTabs secciones={secciones()} />;
}

export function AdminNavInferior() {
  return <NavInferior secciones={secciones()} />;
}
