import type { Metadata } from "next";
import { PaginaConversacion } from "@/features/chat/area";
import { requireUsuario } from "@/lib/session";

export const metadata: Metadata = { title: "Conversación" };

export default async function ConversacionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const usuario = await requireUsuario();
  return <PaginaConversacion conversacionId={id} usuario={usuario} />;
}
