import type { Metadata } from "next";
import { PageHeader } from "@/components/shared/page-header";
import { FormSolicitud } from "@/features/clientes/solicitudes/components/form-solicitud";
import { requireRol } from "@/lib/session";

export const metadata: Metadata = { title: "Nuevo pedido" };

export default async function NuevoPedidoPage() {
  await requireRol("CLIENTE");
  return (
    <div className="mx-auto grid max-w-5xl gap-8">
      <PageHeader
        title="¿Qué necesitás mover?"
        description="Cinco pasos y listo: los fleteros de la zona te mandan presupuestos y vos elegís."
      />
      <FormSolicitud />
    </div>
  );
}
