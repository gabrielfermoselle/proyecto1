import { LayoutMensajes } from "@/features/chat/area";

export default function MensajesLayout({ children }: { children: React.ReactNode }) {
  return <LayoutMensajes rol="CLIENTE">{children}</LayoutMensajes>;
}
