import Link from "next/link";
import type { UsuarioActual } from "@/lib/session";
import { cn } from "@/lib/utils";
import { Logo } from "./logo";
import { SignOutButton } from "./sign-out-button";

const ETIQUETA_ROL: Record<UsuarioActual["rol"], string> = {
  CLIENTE: "Cliente",
  FLETERO: "Fletero",
  ADMIN: "Administración",
};

/**
 * Marco común de las áreas privadas: el toldo verde con el logo, la navegación del rol (desde
 * escritorio), la acción principal y la cuenta. En el celular la navegación va abajo, al alcance
 * del pulgar.
 */
export function AppShell({
  usuario,
  nav,
  mobileNav,
  accionPrincipal,
  headerExtra,
  children,
}: {
  usuario: Pick<UsuarioActual, "nombre" | "rol">;
  nav?: React.ReactNode;
  /** Barra inferior fija en el celular (fuera del header: su backdrop-filter rompería el position: fixed). */
  mobileNav?: React.ReactNode;
  /** Botón destacado del rol (p. ej. "Nuevo pedido"), en el toldo desde escritorio. */
  accionPrincipal?: React.ReactNode;
  /** Acciones del encabezado antes de la cuenta (p. ej. la campana de notificaciones). */
  headerExtra?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="toldo sticky top-0 z-30 bg-secondary text-secondary-foreground">
        <div className="container flex h-16 items-center gap-6">
          <Logo href="/panel" sobreToldo />
          {nav ? <div className="hidden h-full flex-1 lg:block">{nav}</div> : <div className="flex-1" />}
          <div className="flex items-center gap-1 sm:gap-2">
            {accionPrincipal ? <div className="hidden lg:block">{accionPrincipal}</div> : null}
            {headerExtra}
            <Link
              href="/perfil"
              className="flex items-center gap-2 rounded-full py-1 pl-1 pr-1 transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent sm:pr-3"
            >
              <span
                aria-hidden="true"
                className="grid size-9 place-items-center rounded-full bg-accent font-heading text-base font-extrabold text-accent-foreground"
              >
                {usuario.nombre.charAt(0).toUpperCase()}
              </span>
              <span className="hidden text-left text-sm leading-tight sm:block">
                <span className="block font-semibold">{usuario.nombre}</span>
                <span className="text-secondary-foreground/75">{ETIQUETA_ROL[usuario.rol]}</span>
              </span>
              <span className="sr-only sm:hidden">Mi cuenta</span>
            </Link>
            <SignOutButton sobreToldo />
          </div>
        </div>
      </header>
      <main id="contenido" className={cn("container flex-1 py-6 sm:py-8", mobileNav && "pb-28 lg:pb-8")}>
        {children}
      </main>
      {mobileNav}
    </div>
  );
}
