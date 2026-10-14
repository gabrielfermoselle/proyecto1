// [FUERA-S3] [FE] Pantalla del chat. Fuera de los sprints 1-3: el código original queda comentado abajo.
import { notFound } from "next/navigation";

export default function Page() {
  notFound();
}

// import type { Metadata } from "next";
// import { PaginaChatDelPedido } from "@/features/chat/area";
// import { requireRol } from "@/lib/session";
//
// export const metadata: Metadata = { title: "Chat del pedido" };
//
// export default async function ChatDelPedidoPage({ params }: { params: Promise<{ pedidoId: string }> }) {
//   const { pedidoId } = await params;
//   const usuario = await requireRol("CLIENTE", "FLETERO");
//   return <PaginaChatDelPedido solicitudId={pedidoId} usuario={usuario} />;
// }
