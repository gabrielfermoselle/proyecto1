import { Truck } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

/** Marca: el camioncito en una chapa bordó con filete dorado, como la caja pintada de un flete. */
export function Logo({ href = "/", sobreToldo = false }: { href?: string; sobreToldo?: boolean }) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex shrink-0 items-center gap-2.5 rounded-md font-heading text-lg font-extrabold tracking-tight focus-visible:outline-none focus-visible:ring-2",
        sobreToldo ? "focus-visible:ring-accent" : "focus-visible:ring-ring",
      )}
    >
      <span
        className={cn(
          "grid size-9 place-items-center rounded-md bg-primary text-primary-foreground ring-1 ring-inset ring-accent/70",
        )}
      >
        <Truck className="size-5" aria-hidden="true" />
      </span>
      <span>
        Fletes <span className={sobreToldo ? "text-accent" : "text-primary"}>Tucumán</span>
      </span>
    </Link>
  );
}
