import { ExternalLink } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { SeccionCard } from "@/components/shared/seccion-card";
import { Button } from "@/components/ui/button";
import { DatosForm } from "@/features/fleteros/perfil/components/datos-form";
import { DisponibilidadSwitch } from "@/features/fleteros/perfil/components/disponibilidad-switch";
import { TarifasForm } from "@/features/fleteros/perfil/components/tarifas-form";
import { VehiculosEditor } from "@/features/fleteros/perfil/components/vehiculos-editor";
import { ZonaForm } from "@/features/fleteros/perfil/components/zona-form";
import { getPerfilFletero } from "@/features/fleteros/perfil/queries";
import { requireFletero } from "@/lib/session";

export const metadata: Metadata = { title: "Mi perfil" };

export default async function PerfilFleteroPage() {
  const { fleteroId } = await requireFletero();
  const perfil = await getPerfilFletero(fleteroId);

  return (
    <div className="mx-auto grid max-w-3xl gap-6">
      <PageHeader
        title="Mi perfil"
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
      <DisponibilidadSwitch disponible={perfil.disponible} />
      <SeccionCard
        id="datos"
        titulo="Tus datos"
        descripcion="Tu nombre y presentación se muestran en tu perfil público."
      >
        <DatosForm inicial={perfil.datos} />
      </SeccionCard>
      <SeccionCard
        id="vehiculos"
        titulo="Vehículos"
        descripcion="Solo vas a ver solicitudes que entren en algún vehículo activo."
      >
        <VehiculosEditor vehiculos={perfil.vehiculos} storage={perfil.storage} />
      </SeccionCard>
      <SeccionCard
        id="zona"
        titulo="Zona de trabajo"
        descripcion="Ves las solicitudes cuyo origen está dentro de este radio."
      >
        <ZonaForm inicial={perfil.zona} />
      </SeccionCard>
      <SeccionCard
        id="tarifas"
        titulo="Tarifas"
        descripcion="Se usan para sugerirte el precio de cada presupuesto."
      >
        <TarifasForm inicial={perfil.tarifas} />
      </SeccionCard>
    </div>
  );
}
