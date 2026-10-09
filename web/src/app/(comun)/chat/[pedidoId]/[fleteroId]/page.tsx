import type { Metadata } from "next";
import { PaginaChatConFletero } from "@/features/chat/area";
import { requireRol } from "@/lib/session";

export const metadata: Metadata = { title: "Chat del pedido" };

type Props = { params: Promise<{ pedidoId: string; fleteroId: string }> };

export default async function ChatConFleteroPage({ params }: Props) {
  const { pedidoId, fleteroId } = await params;
  const usuario = await requireRol("CLIENTE");
  return <PaginaChatConFletero solicitudId={pedidoId} fleteroId={fleteroId} usuario={usuario} />;
}
