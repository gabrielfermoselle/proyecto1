"use client";

import { cn } from "@/lib/utils";
import { useChat } from "./chat-provider";

/** Cantidad de mensajes sin leer, para la navegación. No muestra nada si no hay. */
export function NoLeidosBadge({ className }: { className?: string }) {
  const { noLeidos } = useChat();
  if (noLeidos === 0) return null;
  return (
    <span
      className={cn(
        "grid h-5 min-w-5 place-items-center rounded-full bg-primary px-1 text-[11px] font-bold text-primary-foreground",
        className,
      )}
    >
      {noLeidos > 99 ? "99+" : noLeidos}
      <span className="sr-only"> sin leer</span>
    </span>
  );
}
