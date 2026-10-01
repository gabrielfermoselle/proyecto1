import type { UsuarioActual } from "@/lib/session";
import { cn } from "@/lib/utils";
import { Logo } from "./logo";
import { SignOutButton } from "./sign-out-button";

const ETIQUETA_ROL: Record<UsuarioActual["rol"], string> = {
  CLIENTE: "Cliente",
  FLETERO: "Fletero",
  ADMIN: "Administración",
};

/** Marco común de las áreas privadas. La navegación propia de cada rol llega como `nav`. */
export function AppShell({
  usuario,
  nav,
  mobileNav,
  children,
}: {
  usuario: Pick<UsuarioActual, "nombre" | "rol">;
  nav?: React.ReactNode;
  /** Barra inferior fija en el celular (fuera del header: su backdrop-filter rompería el position: fixed). */
  mobileNav?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="container flex h-16 items-center justify-between gap-4">
          <Logo href="/panel" />
          <div className="flex items-center gap-2">
            <p className="hidden text-right text-sm leading-tight sm:block">
              <span className="block font-semibold">{usuario.nombre}</span>
              <span className="text-muted-foreground">{ETIQUETA_ROL[usuario.rol]}</span>
            </p>
            <SignOutButton />
          </div>
        </div>
        {nav ? <div className="container">{nav}</div> : null}
      </header>
      <main id="contenido" className={cn("container flex-1 py-6 sm:py-8", mobileNav && "pb-28 md:pb-8")}>
        {children}
      </main>
      {mobileNav}
    </div>
  );
}
