import { ExternalLink } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { DatosForm } from "@/features/fleteros/perfil/components/datos-form";
import { DisponibilidadSwitch } from "@/features/fleteros/perfil/components/disponibilidad-switch";
import { TarifasForm } from "@/features/fleteros/perfil/components/tarifas-form";
import { VehiculosEditor } from "@/features/fleteros/perfil/components/vehiculos-editor";
import { ZonaForm } from "@/features/fleteros/perfil/components/zona-form";
import { getPerfilFletero } from "@/features/fleteros/perfil/queries";
import { requireFletero } from "@/lib/session";

export const metadata: Metadata = { title: "Mi perfil" };

function Seccion({
  id,
  titulo,
  descripcion,
  children,
}: {
  id: string;
  titulo: string;
  descripcion: string;
  children: React.ReactNode;
}) {
  return (
    <Card id={id} className="scroll-mt-32">
      <CardHeader>
        <h2 className="text-xl font-bold">{titulo}</h2>
        <CardDescription>{descripcion}</CardDescription>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

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
      <Seccion
        id="datos"
        titulo="Tus datos"
        descripcion="Tu nombre y presentación se muestran en tu perfil público."
      >
        <DatosForm inicial={perfil.datos} />
      </Seccion>
      <Seccion
        id="vehiculos"
        titulo="Vehículos"
        descripcion="Solo vas a ver solicitudes que entren en algún vehículo activo."
      >
        <VehiculosEditor vehiculos={perfil.vehiculos} fotosHabilitadas={perfil.fotosHabilitadas} />
      </Seccion>
      <Seccion
        id="zona"
        titulo="Zona de trabajo"
        descripcion="Ves las solicitudes cuyo origen está dentro de este radio."
      >
        <ZonaForm inicial={perfil.zona} />
      </Seccion>
      <Seccion
        id="tarifas"
        titulo="Tarifas"
        descripcion="Se usan para sugerirte el precio de cada presupuesto."
      >
        <TarifasForm inicial={perfil.tarifas} />
      </Seccion>
    </div>
  );
}
