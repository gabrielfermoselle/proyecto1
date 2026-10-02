"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useChat } from "@/features/chat/components/chat-provider";
import { topicFlete } from "../rutas";

const INTERVALO_CONSULTAS_MS = 15_000;

/**
 * Mantiene la página del flete al día: con Realtime, cada cambio de etapa o del inventario
 * refresca los datos del servidor; sin Realtime, se consulta cada 15 s con la pestaña visible.
 * No muestra nada.
 */
export function FleteEnVivo({ fleteId, activo }: { fleteId: string; activo: boolean }) {
  const router = useRouter();
  const { realtime, autorizarCanal } = useChat();

  useEffect(() => {
    if (!activo) return;
    if (!realtime) {
      const intervalo = setInterval(() => {
        if (document.visibilityState === "visible") router.refresh();
      }, INTERVALO_CONSULTAS_MS);
      return () => clearInterval(intervalo);
    }
    let vigente = true;
    let canal: ReturnType<typeof realtime.channel> | null = null;
    const topic = topicFlete(fleteId);
    void autorizarCanal(topic).then(() => {
      if (!vigente) return;
      canal = realtime
        .channel(topic, { config: { private: true } })
        .on("broadcast", { event: "flete.actualizado" }, () => router.refresh())
        // Al (re)conectar se trae lo que haya cambiado mientras tanto.
        .subscribe((estado) => {
          if (estado === "SUBSCRIBED") router.refresh();
        });
    });
    return () => {
      vigente = false;
      if (canal) void realtime.removeChannel(canal);
    };
  }, [fleteId, activo, realtime, autorizarCanal, router]);

  return null;
}
