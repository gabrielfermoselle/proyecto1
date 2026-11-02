"use client";

import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { BandejaLista } from "./bandeja-lista";

/**
 * Escritorio: bandeja y conversación lado a lado. Celular y tablet: dos pantallas; la conversación
 * ocupa todo el alto bajo el toldo (sin la barra inferior, que taparía el composer).
 */
export function MensajesLayout({
  base,
  textoVacio,
  children,
}: {
  base: string;
  textoVacio: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const enConversacion = pathname.startsWith(`${base}/`);
  return (
    <div className="grid lg:h-[calc(100dvh-8rem)] lg:grid-cols-[340px_minmax(0,1fr)] lg:overflow-hidden lg:rounded-xl lg:border lg:bg-card lg:shadow-sm">
      <aside
        aria-label="Conversaciones"
        className={cn("min-h-0 overflow-y-auto lg:border-r", enConversacion && "hidden lg:block")}
      >
        <h1 className="px-3 pb-2 pt-1 text-3xl font-extrabold lg:border-b lg:pb-3 lg:pt-3 lg:text-lg">
          Chat
        </h1>
        <BandejaLista textoVacio={textoVacio} />
      </aside>
      <div
        className={cn(
          "min-h-0",
          enConversacion ? "fixed inset-x-0 bottom-0 top-16 z-20 lg:static lg:z-auto" : "hidden lg:block",
        )}
      >
        {children}
      </div>
    </div>
  );
}
