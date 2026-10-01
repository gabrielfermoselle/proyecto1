import { redirect } from "next/navigation";
import { primerPasoPendiente } from "@/domain/onboarding";
import { getPerfilFletero } from "@/features/fleteros/perfil/queries";
import { requireFletero } from "@/lib/session";

/** Retoma el onboarding en el primer paso que falta. */
export default async function OnboardingPage() {
  const { fleteroId } = await requireFletero({ permitirOnboardingIncompleto: true });
  const perfil = await getPerfilFletero(fleteroId);
  if (perfil.onboardingCompleto) redirect("/fletero");
  redirect(`/fletero/onboarding/${primerPasoPendiente(perfil.progreso) ?? "tarifas"}`);
}
