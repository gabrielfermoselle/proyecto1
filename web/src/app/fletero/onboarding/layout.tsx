import { AppShell } from "@/components/shared/app-shell";
import { requireFletero } from "@/lib/session";

export default async function OnboardingLayout({ children }: { children: React.ReactNode }) {
  const { usuario } = await requireFletero({ permitirOnboardingIncompleto: true });
  return <AppShell usuario={usuario}>{children}</AppShell>;
}
