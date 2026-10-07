import Link from "next/link";
import { Logo } from "@/components/shared/logo";
import { Button } from "@/components/ui/button";
import { getUsuarioActual } from "@/lib/session";

/** Páginas públicas de fleteros: se ven con o sin sesión. */
export default async function FleterosPublicoLayout({ children }: { children: React.ReactNode }) {
  const usuario = await getUsuarioActual();
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b">
        <div className="container flex h-16 items-center justify-between gap-4">
          <Logo href={usuario ? "/panel" : "/"} />
          <Button asChild variant="ghost" size="sm">
            {usuario ? <Link href="/panel">Ir a mi panel</Link> : <Link href="/login">Ingresar</Link>}
          </Button>
        </div>
      </header>
      <main id="contenido" className="container flex-1 py-6 sm:py-8">
        {children}
      </main>
    </div>
  );
}
