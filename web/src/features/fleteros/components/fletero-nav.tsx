"use client";

import { CalendarDays, FileText, Inbox, LayoutDashboard, UserRound } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const SECCIONES = [
  { href: "/fletero", label: "Inicio", Icono: LayoutDashboard, prefijos: [] },
  { href: "/fletero/solicitudes", label: "Solicitudes", Icono: Inbox, prefijos: ["/fletero/solicitudes"] },
  {
    href: "/fletero/agenda",
    label: "Agenda",
    Icono: CalendarDays,
    prefijos: ["/fletero/agenda", "/fletero/fletes"],
  },
  {
    href: "/fletero/presupuestos",
    label: "Presupuestos",
    Icono: FileText,
    prefijos: ["/fletero/presupuestos"],
  },
  { href: "/fletero/perfil", label: "Perfil", Icono: UserRound, prefijos: ["/fletero/perfil"] },
] as const;

function estaActiva(pathname: string, seccion: (typeof SECCIONES)[number]) {
  if (seccion.prefijos.length === 0) return pathname === seccion.href;
  return seccion.prefijos.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/** Pestañas bajo el header (escritorio). */
export function FleteroNavTabs() {
  const pathname = usePathname();
  return (
    <nav aria-label="Secciones" className="-mb-px hidden md:block">
      <ul className="flex gap-6">
        {SECCIONES.map((seccion) => {
          const activa = estaActiva(pathname, seccion);
          return (
            <li key={seccion.href}>
              <Link
                href={seccion.href}
                aria-current={activa ? "page" : undefined}
                className={cn(
                  "flex h-12 items-center gap-2 border-b-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  activa
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                <seccion.Icono className="size-4" aria-hidden="true" />
                {seccion.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Barra inferior fija (celular): al alcance del pulgar, con objetivos de 56 px. */
export function FleteroNavInferior() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Secciones"
      className="fixed inset-x-0 bottom-0 z-30 border-t bg-card pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <ul className="grid grid-cols-5">
        {SECCIONES.map((seccion) => {
          const activa = estaActiva(pathname, seccion);
          return (
            <li key={seccion.href}>
              <Link
                href={seccion.href}
                aria-current={activa ? "page" : undefined}
                className={cn(
                  "flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                  activa ? "text-primary" : "text-muted-foreground",
                )}
              >
                <seccion.Icono className={cn("size-6", activa && "stroke-[2.5]")} aria-hidden="true" />
                {seccion.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
