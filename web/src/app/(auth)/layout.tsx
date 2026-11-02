import { BadgeCheck, ClipboardList, MessagesSquare } from "lucide-react";
import Link from "next/link";
import { Logo } from "@/components/shared/logo";

const PUNTOS = [
  { Icono: ClipboardList, texto: "Publicás qué necesitás mover y recibís presupuestos." },
  { Icono: BadgeCheck, texto: "Fleteros con reseñas de clientes reales y documentación verificada." },
  { Icono: MessagesSquare, texto: "Hablás por el chat; el teléfono se comparte al aceptar." },
];

/**
 * Login, registro y recuperación. En escritorio, la mitad izquierda es el azul marino de la marca
 * con los tres puntos unidos por la ruta punteada; en el celular queda solo el formulario.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <aside className="relative hidden overflow-hidden bg-secondary text-secondary-foreground lg:flex lg:flex-col lg:justify-between lg:gap-12 lg:p-12 xl:p-16">
        <Logo sobreToldo />
        <div className="grid max-w-md gap-10">
          <p className="font-heading text-4xl font-extrabold leading-[1.1] xl:text-5xl">
            Tu flete en Tucumán, <span className="text-accent-on-dark">al precio que vos elegís.</span>
          </p>
          <ol className="relative grid gap-8">
            <span
              aria-hidden="true"
              className="absolute bottom-5 left-5 top-5 w-0.5 -translate-x-1/2 bg-[linear-gradient(to_bottom,currentColor_55%,transparent_0)] bg-[length:2px_10px] text-secondary-muted/50"
            />
            {PUNTOS.map(({ Icono, texto }) => (
              <li key={texto} className="relative flex items-start gap-4 text-lg">
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-secondary ring-2 ring-secondary-muted/60">
                  <Icono className="size-5" aria-hidden="true" />
                </span>
                <span className="pt-1.5 text-secondary-muted">{texto}</span>
              </li>
            ))}
          </ol>
        </div>
        <p className="text-sm text-secondary-muted">San Miguel de Tucumán y alrededores</p>
      </aside>

      <div className="flex min-h-dvh flex-col">
        <header className="toldo bg-secondary text-secondary-foreground lg:bg-transparent lg:text-foreground lg:shadow-none">
          <div className="flex h-16 items-center justify-between gap-4 px-4 sm:px-8">
            <span className="lg:invisible">
              <Logo sobreToldo />
            </span>
            <Link
              href="/"
              className="rounded-md text-sm font-semibold text-secondary-foreground/80 transition-colors hover:text-secondary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-on-dark lg:text-muted-foreground lg:hover:text-foreground lg:focus-visible:ring-ring"
            >
              Volver al inicio
            </Link>
          </div>
        </header>
        <main id="contenido" className="flex flex-1 items-start justify-center px-4 pb-12 pt-8 sm:px-8 sm:pt-12 lg:items-center">
          {children}
        </main>
      </div>
    </div>
  );
}
