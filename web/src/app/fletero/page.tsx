import type { Metadata } from "next";
import { PageHeader } from "@/components/shared/page-header";
import { requireRol } from "@/lib/session";

export const metadata: Metadata = { title: "Panel" };

export default async function FleteroInicioPage() {
  const usuario = await requireRol("FLETERO");
  return (
    <PageHeader
      title={`Hola, ${usuario.nombre}`}
      description="Acá vas a ver las solicitudes cerca tuyo, tus presupuestos y tu agenda de fletes."
    />
  );
}
