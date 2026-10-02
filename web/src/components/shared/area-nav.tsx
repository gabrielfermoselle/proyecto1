"use client";

import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export interface SeccionNav {
  href: string;
  label: string;
  Icono: LucideIcon;
  /** Rutas que, además de `href` exacto, marcan la sección como activa. */
  prefijos: readonly string[];
  /** Si aparece en la barra inferior del celular (que tiene lugar para 5). */
  enInferior: boolean;
  /** Contenido extra junto al nombre (p. ej. la cantidad de mensajes sin leer). */
  extra?: React.ReactNode;
}

function estaActiva(pathname: string, seccion: SeccionNav) {
  if (pathname === seccion.href) return true;
  return seccion.prefijos.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/** Pestañas bajo el header (escritorio). */
export function NavTabs({ secciones }: { secciones: SeccionNav[] }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Secciones" className="-mb-px hidden md:block">
      <ul className="flex gap-6">
        {secciones.map((s) => {
          const activa = estaActiva(pathname, s);
          return (
            <li key={s.href}>
              <Link
                href={s.href}
                aria-current={activa ? "page" : undefined}
                className={cn(
                  "flex h-12 items-center gap-2 border-b-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  activa
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                <s.Icono className="size-4" aria-hidden="true" />
                {s.label}
                {s.extra}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Barra inferior fija (celular): al alcance del pulgar, con objetivos de 64 px. */
export function NavInferior({ secciones, ocultarEn }: { secciones: SeccionNav[]; ocultarEn?: RegExp }) {
  const pathname = usePathname();
  // Dentro de una conversación, la barra taparía el composer.
  if (ocultarEn?.test(pathname)) return null;
  const visibles = secciones.filter((s) => s.enInferior);
  return (
    <nav
      aria-label="Secciones"
      className="fixed inset-x-0 bottom-0 z-30 border-t bg-card pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <ul className="grid" style={{ gridTemplateColumns: `repeat(${visibles.length}, minmax(0, 1fr))` }}>
        {visibles.map((s) => {
          const activa = estaActiva(pathname, s);
          return (
            <li key={s.href}>
              <Link
                href={s.href}
                aria-current={activa ? "page" : undefined}
                className={cn(
                  "relative flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                  activa ? "text-primary" : "text-muted-foreground",
                )}
              >
                <s.Icono className={cn("size-6", activa && "stroke-[2.5]")} aria-hidden="true" />
                {s.label}
                {s.extra ? <span className="absolute left-1/2 top-1.5 ml-2">{s.extra}</span> : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
