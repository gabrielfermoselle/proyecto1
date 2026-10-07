import Link from "next/link";
import { cn } from "@/lib/utils";

export interface Segmento {
  href: string;
  label: string;
  activo: boolean;
  contador?: number;
}

/** Pestañas como links: el estado vive en la URL (se comparte, sobrevive al recargar). */
export function SegmentedNav({ segmentos, label }: { segmentos: Segmento[]; label: string }) {
  return (
    <nav aria-label={label} className="-mx-1 overflow-x-auto px-1">
      <ul className="inline-flex min-w-full gap-1 rounded-lg bg-muted p-1 sm:min-w-0">
        {segmentos.map(({ href, label: texto, activo, contador }) => (
          <li key={href} className="flex-1 sm:flex-none">
            <Link
              href={href}
              scroll={false}
              aria-current={activo ? "page" : undefined}
              className={cn(
                "flex h-10 items-center justify-center gap-2 whitespace-nowrap rounded-md px-4 text-sm font-semibold transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                activo ? "bg-card shadow-sm" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {texto}
              {contador !== undefined ? (
                <span className="rounded-full bg-background px-2 text-xs tabular-nums">{contador}</span>
              ) : null}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
