import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { TipoFleteIcono } from "@/components/shared/tipo-flete-icono";
import { getSolicitudDelCliente } from "@/features/clientes/solicitudes/queries";
import { FormCalificacion } from "@/features/fletes/components/form-calificacion";
import { getFleteDetalle } from "@/features/fletes/queries";
import { hrefPedido } from "@/features/fletes/rutas";
import { formatearDia, formatearPesos } from "@/lib/formato";
import { requireCliente } from "@/lib/session";

export const metadata: Metadata = { title: "Calificar al fletero" };

/** Solo con el flete cerrado y sin calificar: si no, vuelve al pedido. */
export default async function CalificarPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { usuario, clienteId } = await requireCliente();
  const s = await getSolicitudDelCliente(clienteId, id);
  if (!s) notFound();
  const f = s.flete ? await getFleteDetalle(s.flete.id, usuario, { firmarFotos: false }) : null;
  if (!f || f.etapa !== "CERRADO" || f.calificacion) redirect(hrefPedido("CLIENTE", id));

  return (
    <div className="mx-auto grid max-w-xl gap-6">
      <Link
        href={hrefPedido("CLIENTE", id)}
        className="inline-flex items-center gap-1.5 justify-self-start rounded-md text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Volver al pedido
      </Link>
      <div className="grid gap-6 rounded-2xl border bg-card p-6 shadow-sm sm:p-8">
        <div className="flex items-center gap-4">
          <TipoFleteIcono tipo={s.tipoFlete} />
          <div className="grid gap-0.5">
            <h1 className="text-2xl font-extrabold leading-tight sm:text-3xl">Calificá a {f.contraparte}</h1>
            <p className="text-sm text-muted-foreground">
              {s.titulo} · {formatearDia(f.fecha)} · {formatearPesos(f.precioAcordado)}
            </p>
          </div>
        </div>
        <FormCalificacion fleteId={f.id} fletero={f.contraparte} volverA={hrefPedido("CLIENTE", id)} />
        <p className="text-sm text-muted-foreground">
          Solo califican los clientes que confirmaron una entrega real: por eso las reseñas valen.
        </p>
      </div>
    </div>
  );
}
