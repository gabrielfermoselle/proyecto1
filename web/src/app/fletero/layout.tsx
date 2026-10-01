import { AppShell } from "@/components/shared/app-shell";
import { requireRol } from "@/lib/session";

export default async function FleteroLayout({ children }: { children: React.ReactNode }) {
  const usuario = await requireRol("FLETERO");
  return <AppShell usuario={usuario}>{children}</AppShell>;
}
