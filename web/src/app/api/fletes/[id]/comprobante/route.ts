import { renderizarComprobante } from "@/features/fletes/comprobante/documento";
import { getFleteDetalle } from "@/features/fletes/queries";
import { json, noAutenticado, noEncontrado } from "@/lib/api";
import { getUsuarioActual } from "@/lib/session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Comprobante PDF del flete: solo sus participantes, desde que el fletero registró la entrega. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const usuario = await getUsuarioActual();
  if (!usuario) return noAutenticado();
  const { id } = await params;
  const flete = await getFleteDetalle(id, usuario, { firmarFotos: false });
  if (!flete) return noEncontrado();
  if (flete.etapa !== "ENTREGADO" && flete.etapa !== "CERRADO") {
    return json({ error: "El comprobante está disponible desde que el fletero registra la entrega." }, 409);
  }

  const pdf = await renderizarComprobante(flete);
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="comprobante-flete-${flete.id}.pdf"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
