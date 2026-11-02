import { Truck } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * Marca: el camioncito en una chapa naranja, el color de "andá". Sobre el encabezado azul marino,
 * "Tucumán" va en naranja claro; sobre blanco, en azul.
 */
export function Logo({
  href = "/",
  sobreToldo = false,
  compactoEnCelular = false,
}: {
  href?: string;
  sobreToldo?: boolean;
  /** Debajo de 400 px queda solo la chapa (el nombre sigue para lectores de pantalla). */
  compactoEnCelular?: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex shrink-0 items-center gap-2.5 rounded-md font-heading text-lg font-extrabold tracking-tight focus-visible:outline-none focus-visible:ring-2",
        sobreToldo ? "focus-visible:ring-accent-on-dark" : "focus-visible:ring-ring",
      )}
    >
      <span className="grid size-9 place-items-center rounded-md bg-accent text-accent-foreground shadow-sm">
        <Truck className="size-5" aria-hidden="true" />
      </span>
      <span className={cn(compactoEnCelular && "max-[399px]:sr-only")}>
        Fletes <span className={sobreToldo ? "text-accent-on-dark" : "text-primary"}>Tucumán</span>
      </span>
    </Link>
  );
}
