import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { FormSolicitud } from "@/features/clientes/solicitudes/components/form-solicitud";
import { requireRol } from "@/lib/session";

export const metadata: Metadata = { title: "Publicar un flete" };

export default async function NuevaSolicitudPage() {
  await requireRol("CLIENTE");
  return (
    <div className="mx-auto grid max-w-4xl gap-2">
      <Button asChild variant="ghost" size="sm" className="justify-self-start">
        <Link href="/cliente/solicitudes">
          <ArrowLeft aria-hidden="true" />
          Mis solicitudes
        </Link>
      </Button>
      <PageHeader
        title="Publicar un flete"
        description="Los fleteros de la zona ven tu pedido y te mandan presupuestos. Tu teléfono y tu dirección exacta no se muestran."
      />
      <FormSolicitud />
    </div>
  );
}
