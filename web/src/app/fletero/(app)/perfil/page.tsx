import { ArrowRight, ExternalLink } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { SeccionCard } from "@/components/shared/seccion-card";
import { Button } from "@/components/ui/button";
import { DisponibilidadSwitch } from "@/features/fleteros/perfil/components/disponibilidad-switch";
import { DocumentosEditor } from "@/features/fleteros/perfil/components/documentos-editor";
import { TarifasForm } from "@/features/fleteros/perfil/components/tarifas-form";
import { VehiculosEditor } from "@/features/fleteros/perfil/components/vehiculos-editor";
import { ZonaForm } from "@/features/fleteros/perfil/components/zona-form";
import { getDocumentosFletero, getPerfilFletero } from "@/features/fleteros/perfil/queries";
import { requireFletero } from "@/lib/session";

export const metadata: Metadata = { title: "Vehículo, zona y documentos" };

const SECCIONES = [
  ["vehiculos", "Vehículos"],
  ["zona", "Zona"],
  ["documentos", "Documentos"],
  ["tarifas", "Tarifas"],
] as const;

/** Lo de trabajo del fletero en una sola página. Los datos personales y la contraseña están en /perfil. */
export default async function PerfilFleteroPage() {
  const { fleteroId } = await requireFletero();
  const [perfil, documentos] = await Promise.all([
    getPerfilFletero(fleteroId),
    getDocumentosFletero(fleteroId),
  ]);

  return (
    <div className="mx-auto grid max-w-3xl gap-6">
      <PageHeader
        title="Vehículo, zona y documentos"
        description="Lo que cambies acá se aplica al instante en el buscador y en tus próximos presupuestos."
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href={`/fleteros/${fleteroId}`}>
              Ver mi perfil público
              <ExternalLink aria-hidden="true" />
            </Link>
          </Button>
        }
      />
      <nav aria-label="En esta página" className="-mx-1 overflow-x-auto px-1">
        <ul className="flex gap-2">
          {SECCIONES.map(([id, etiqueta]) => (
            <li key={id}>
              <a
                href={`#${id}`}
                className="inline-flex h-9 items-center whitespace-nowrap rounded-full border bg-card px-4 text-sm font-semibold transition-colors hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {etiqueta}
              </a>
            </li>
          ))}
        </ul>
      </nav>
      <DisponibilidadSwitch disponible={perfil.disponible} />
      <SeccionCard
        id="vehiculos"
        titulo="Vehículos"
        descripcion="Solo vas a ver pedidos que entren en algún vehículo activo."
      >
        <VehiculosEditor vehiculos={perfil.vehiculos} storage={perfil.storage} />
      </SeccionCard>
      <SeccionCard
        id="zona"
        titulo="Zona de trabajo"
        descripcion="Ves los pedidos cuyo origen está dentro de este radio."
      >
        <ZonaForm inicial={perfil.zona} />
      </SeccionCard>
      <SeccionCard
        id="documentos"
        titulo="Documentos"
        descripcion="DNI, licencia y seguro: solo los ven vos y la administración, para verificarte."
      >
        <DocumentosEditor
          documentos={documentos.documentos}
          verificado={documentos.verificado}
          storage={perfil.storage}
        />
      </SeccionCard>
      <SeccionCard
        id="tarifas"
        titulo="Tarifas"
        descripcion="Se usan para sugerirte el precio de cada presupuesto."
      >
        <TarifasForm inicial={perfil.tarifas} />
      </SeccionCard>
      <Link
        href="/perfil"
        className="group flex items-center justify-between gap-3 rounded-xl border border-dashed p-4 text-sm transition-colors hover:border-primary/40 hover:bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span>
          <strong>Tus datos, teléfono y contraseña</strong> están en Mi cuenta.
        </span>
        <ArrowRight
          className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
          aria-hidden="true"
        />
      </Link>
    </div>
  );
}
