import { ArrowLeft, ArrowRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import {
  ETIQUETA_PASO,
  esPasoOnboarding,
  PASOS_ONBOARDING,
  pasosCompletos,
  pasoSiguiente,
  type PasoOnboarding,
} from "@/domain/onboarding";
import { DatosForm } from "@/features/fleteros/perfil/components/datos-form";
import { OnboardingStepper } from "@/features/fleteros/perfil/components/onboarding-stepper";
import { TarifasForm } from "@/features/fleteros/perfil/components/tarifas-form";
import { VehiculosEditor } from "@/features/fleteros/perfil/components/vehiculos-editor";
import { ZonaForm } from "@/features/fleteros/perfil/components/zona-form";
import { getPerfilFletero } from "@/features/fleteros/perfil/queries";
import { requireFletero } from "@/lib/session";

export const metadata: Metadata = { title: "Configurá tu perfil" };

const DESCRIPCION: Record<PasoOnboarding, string> = {
  datos: "Contanos quién sos. Los clientes ven tu nombre y tu presentación, nunca tu teléfono ni tu DNI.",
  vehiculos:
    "Cargá los vehículos con los que trabajás. Usamos la capacidad para mostrarte solo pedidos que te entran.",
  zona: "Elegí desde dónde salís y hasta qué distancia querés trabajar.",
  tarifas:
    "Con tus tarifas calculamos un precio sugerido para cada presupuesto. Siempre vas a poder ajustarlo.",
};

export default async function PasoOnboardingPage({ params }: { params: Promise<{ paso: string }> }) {
  const { paso } = await params;
  if (!esPasoOnboarding(paso)) notFound();

  const { fleteroId } = await requireFletero({ permitirOnboardingIncompleto: true });
  const perfil = await getPerfilFletero(fleteroId);
  if (perfil.onboardingCompleto) redirect("/fletero/perfil");

  const completos = pasosCompletos(perfil.progreso);
  const siguiente = pasoSiguiente(paso);
  const anterior = PASOS_ONBOARDING[PASOS_ONBOARDING.indexOf(paso) - 1];
  const siguienteHref = siguiente ? `/fletero/onboarding/${siguiente}` : undefined;

  return (
    <div className="mx-auto grid max-w-3xl gap-6">
      <div className="grid gap-2">
        <h1 className="text-2xl font-extrabold sm:text-3xl">Configurá tu perfil de fletero</h1>
        <p className="text-muted-foreground">
          Son 4 pasos. Se guarda cada uno, así que podés seguir en otro momento.
        </p>
      </div>
      <OnboardingStepper actual={paso} completos={completos} />

      <Card>
        <CardHeader>
          <h2 className="text-xl font-bold">{ETIQUETA_PASO[paso]}</h2>
          <CardDescription>{DESCRIPCION[paso]}</CardDescription>
        </CardHeader>
        <CardContent>
          {paso === "datos" ? (
            <DatosForm inicial={perfil.datos} {...(siguienteHref ? { siguienteHref } : {})} />
          ) : null}
          {paso === "vehiculos" ? (
            <div className="grid gap-6">
              <VehiculosEditor vehiculos={perfil.vehiculos} storage={perfil.storage} />
              {completos.vehiculos && siguienteHref ? (
                <Button asChild className="w-full sm:w-auto sm:justify-self-end">
                  <Link href={siguienteHref}>
                    Continuar
                    <ArrowRight aria-hidden="true" />
                  </Link>
                </Button>
              ) : null}
            </div>
          ) : null}
          {paso === "zona" ? (
            <ZonaForm inicial={perfil.zona} {...(siguienteHref ? { siguienteHref } : {})} />
          ) : null}
          {paso === "tarifas" ? <TarifasForm inicial={perfil.tarifas} onboarding /> : null}
        </CardContent>
      </Card>

      {anterior ? (
        <Button asChild variant="ghost" className="justify-self-start">
          <Link href={`/fletero/onboarding/${anterior}`}>
            <ArrowLeft aria-hidden="true" />
            Volver a {ETIQUETA_PASO[anterior].toLowerCase()}
          </Link>
        </Button>
      ) : null}
    </div>
  );
}
