import { redirigirFlete } from "@/features/areas/rutas-viejas";
import { requireRol } from "@/lib/session";

/** Ruta vieja del flete: ahora todo pasa en la página del pedido. */
export default async function FleteViejoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return redirigirFlete(id, await requireRol("FLETERO"));
}
