import { Truck } from "lucide-react";
import Link from "next/link";

export function Logo({ href = "/" }: { href?: string }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-2 rounded-md font-heading text-lg font-extrabold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span className="grid size-9 place-items-center rounded-md bg-primary text-primary-foreground">
        <Truck className="size-5" aria-hidden="true" />
      </span>
      Fletes Tucumán
    </Link>
  );
}
