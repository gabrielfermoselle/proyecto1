import { LayoutMensajes } from "@/features/chat/area";
import { requireRol } from "@/lib/session";

export default async function ChatLayout({ children }: { children: React.ReactNode }) {
  const usuario = await requireRol("CLIENTE", "FLETERO");
  return <LayoutMensajes rol={usuario.rol === "CLIENTE" ? "CLIENTE" : "FLETERO"}>{children}</LayoutMensajes>;
}
