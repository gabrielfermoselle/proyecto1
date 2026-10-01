import type { Metadata } from "next";
import { PageHeader } from "@/components/shared/page-header";

export const metadata: Metadata = { title: "Administración" };

export default function AdminInicioPage() {
  return <PageHeader title="Administración" description="Gestión de usuarios, fleteros y solicitudes." />;
}
