import { BrickWall, House, Package, PackageOpen, Sofa } from "lucide-react";
import type { TipoFlete } from "@/domain/catalogos";
import { cn } from "@/lib/utils";

const ICONO: Record<TipoFlete, typeof House> = {
  MUDANZA: House,
  MUEBLES: Sofa,
  COMPRAS: BrickWall,
  PAQUETERIA: Package,
  OTRO: PackageOpen,
};

/** Chapa con el ícono del tipo de flete, para listas y encabezados. */
export function TipoFleteIcono({ tipo, className }: { tipo: TipoFlete; className?: string }) {
  const Icono = ICONO[tipo];
  return (
    <span
      aria-hidden="true"
      className={cn(
        "grid size-11 shrink-0 place-items-center rounded-lg bg-secondary text-secondary-foreground ring-1 ring-inset ring-accent/40 [&_svg]:size-5",
        className,
      )}
    >
      <Icono />
    </span>
  );
}

export const iconoTipoFlete = (tipo: TipoFlete) => ICONO[tipo];
