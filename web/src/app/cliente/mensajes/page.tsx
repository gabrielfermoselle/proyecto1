import type { Metadata } from "next";
import { SinConversacionElegida } from "@/features/chat/area";

export const metadata: Metadata = { title: "Mensajes" };

export default function MensajesPage() {
  return <SinConversacionElegida />;
}
