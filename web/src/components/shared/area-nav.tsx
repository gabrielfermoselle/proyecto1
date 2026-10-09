"use client";

import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export interface SeccionNav {
  href: string;
  label: string;
  /** Nombre corto para la barra inferior del celular (si el largo no entra). */
  labelCorto?: string;
  Icono: LucideIcon;
  /** Rutas que, además de `href` exacto, marcan la sección como activa. */
  prefijos: readonly string[];
  /** Si aparece en la barra inferior del celular (que tiene lugar para 5). */
  enInferior: boolean;
  /** Si aparece en las pestañas del toldo (la acción principal ya tiene su botón ahí). */
  enSuperior?: boolean;
  /** Acción principal del rol: en la barra inferior va al centro, resaltada. */
  destacada?: boolean;
  /** Contenido extra junto al nombre (p. ej. la cantidad de mensajes sin leer). */
  extra?: React.ReactNode;
}

function estaActiva(pathname: string, seccion: SeccionNav) {
  if (pathname === seccion.href) return true;
  return seccion.prefijos.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/** Pestañas sobre el toldo (escritorio): la activa lleva el filete dorado debajo. */
export function NavTabs({ secciones }: { secciones: SeccionNav[] }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Secciones" className="h-full">
      <ul className="flex h-full gap-1">
        {secciones
          .filter((s) => s.enSuperior !== false)
          .map((s) => {
            const activa = estaActiva(pathname, s);
            return (
              <li key={s.href} className="h-full">
                <Link
                  href={s.href}
                  // Las secciones principales se precargan enteras: el click es instantáneo.
                  prefetch
                  aria-current={activa ? "page" : undefined}
                  className={cn(
                    "relative flex h-full items-center gap-2 px-3 text-sm font-semibold transition-colors",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent",
                    "after:absolute after:inset-x-3 after:bottom-0 after:h-[3px] after:rounded-t-full after:transition-colors",
                    activa
                      ? "text-secondary-foreground after:bg-accent"
                      : "text-secondary-foreground/75 after:bg-transparent hover:text-secondary-foreground",
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

/** Barra inferior fija (celular y tablet): al alcance del pulgar, con objetivos de 64 px. */
export function NavInferior({ secciones, ocultarEn }: { secciones: SeccionNav[]; ocultarEn?: RegExp }) {
  const pathname = usePathname();
  // Dentro de una conversación, la barra taparía el composer.
  if (ocultarEn?.test(pathname)) return null;
  const visibles = secciones.filter((s) => s.enInferior);
  return (
    <nav
      aria-label="Secciones"
      className="fixed inset-x-0 bottom-0 z-30 border-t bg-card/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_16px_rgb(28_22_19/0.06)] backdrop-blur supports-[backdrop-filter]:bg-card/85 lg:hidden"
    >
      <ul className="grid" style={{ gridTemplateColumns: `repeat(${visibles.length}, minmax(0, 1fr))` }}>
        {visibles.map((s) => {
          const activa = estaActiva(pathname, s);
          if (s.destacada) {
            return (
              <li key={s.href} className="grid place-items-center">
                <Link
                  href={s.href}
                  // Las secciones principales se precargan enteras: el click es instantáneo.
                  prefetch
                  aria-current={activa ? "page" : undefined}
                  className="flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-semibold text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                >
                  <span className="-mt-6 grid size-12 place-items-center rounded-full bg-primary text-primary-foreground shadow-md ring-4 ring-card">
                    <s.Icono className="size-6" aria-hidden="true" />
                  </span>
                  {s.labelCorto ?? s.label}
                </Link>
              </li>
            );
          }
          return (
            <li key={s.href}>
              <Link
                href={s.href}
                prefetch
                aria-current={activa ? "page" : undefined}
                className={cn(
                  "relative flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                  activa ? "text-primary" : "text-muted-foreground",
                )}
              >
                <span
                  className={cn(
                    "grid h-7 w-12 place-items-center rounded-full transition-colors",
                    activa && "bg-primary/10",
                  )}
                >
                  <s.Icono className={cn("size-5", activa && "stroke-[2.5]")} aria-hidden="true" />
                </span>
                {s.labelCorto ?? s.label}
                {s.extra ? <span className="absolute left-1/2 top-1 ml-2">{s.extra}</span> : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
