import type { Metadata } from "next";
import { PageHeader } from "@/components/shared/page-header";
import { requireRol } from "@/lib/session";

export const metadata: Metadata = { title: "Mis fletes" };

export default async function ClienteInicioPage() {
  const usuario = await requireRol("CLIENTE");
  return (
    <PageHeader
      title={`Hola, ${usuario.nombre}`}
      description="Acá vas a ver tus solicitudes, los presupuestos que recibas y el estado de cada flete."
    />
  );
}
