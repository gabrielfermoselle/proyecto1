import { BadgeCheck, ClipboardList, MessagesSquare } from "lucide-react";
import Link from "next/link";
import { Logo } from "@/components/shared/logo";

const PUNTOS = [
  { Icono: ClipboardList, texto: "Publicás qué necesitás mover y recibís presupuestos." },
  { Icono: BadgeCheck, texto: "Fleteros con reseñas de clientes reales y documentación verificada." },
  { Icono: MessagesSquare, texto: "Hablás por el chat; el teléfono se comparte al aceptar." },
];

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="toldo bg-secondary text-secondary-foreground">
        <div className="container flex h-16 items-center justify-between gap-4">
          <Logo sobreToldo />
          <Link
            href="/"
            className="rounded-md text-sm font-semibold text-secondary-foreground/80 transition-colors hover:text-secondary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            Volver al inicio
          </Link>
        </div>
      </header>
      <main
        id="contenido"
        className="container grid flex-1 items-start gap-10 pb-12 pt-8 sm:pt-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,36rem)] lg:items-center lg:gap-16"
      >
        <aside className="hidden gap-6 lg:grid">
          <p className="font-heading text-4xl font-extrabold leading-tight">
            Tu flete en Tucumán, <span className="text-primary">al precio que vos elegís.</span>
          </p>
          <ul className="grid gap-4">
            {PUNTOS.map(({ Icono, texto }) => (
              <li key={texto} className="flex items-start gap-3 text-lg">
                <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-secondary text-secondary-foreground ring-1 ring-inset ring-accent/40">
                  <Icono className="size-5" aria-hidden="true" />
                </span>
                <span className="pt-1.5">{texto}</span>
              </li>
            ))}
          </ul>
        </aside>
        <div className="flex justify-center">{children}</div>
      </main>
    </div>
  );
}
