// [FUERA-S3] [FE] Pantalla del chat (ruta vieja de una conversación). Fuera de los sprints 1-3: el código original queda comentado abajo.
import { notFound } from "next/navigation";

export default function Page() {
  notFound();
}

// import { redirigirConversacion } from "@/features/areas/rutas-viejas";
// import { requireRol } from "@/lib/session";
//
// /** Ruta vieja de una conversación: ahora el chat es por pedido, en /chat. */
// export default async function ConversacionViejaPage({ params }: { params: Promise<{ id: string }> }) {
//   const { id } = await params;
//   return redirigirConversacion(id, await requireRol("CLIENTE"));
// }
