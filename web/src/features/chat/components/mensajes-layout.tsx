"use client";

import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { BandejaLista } from "./bandeja-lista";

/**
 * Escritorio: bandeja y conversación lado a lado. Celular: dos pantallas; la conversación ocupa
 * todo el alto bajo el encabezado (sin la barra inferior, que taparía el composer).
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
    <div className="grid md:h-[calc(100dvh-11rem)] md:grid-cols-[340px_minmax(0,1fr)] md:overflow-hidden md:rounded-lg md:border md:bg-card">
      <aside
        aria-label="Conversaciones"
        className={cn("min-h-0 overflow-y-auto md:border-r", enConversacion && "hidden md:block")}
      >
        <h1 className="px-3 pb-2 pt-1 text-2xl font-extrabold md:border-b md:pb-3 md:pt-3 md:text-lg">
          Mensajes
        </h1>
        <BandejaLista textoVacio={textoVacio} />
      </aside>
      <div
        className={cn(
          "min-h-0",
          enConversacion ? "fixed inset-x-0 bottom-0 top-16 z-20 md:static md:z-auto" : "hidden md:block",
        )}
      >
        {children}
      </div>
    </div>
  );
}
