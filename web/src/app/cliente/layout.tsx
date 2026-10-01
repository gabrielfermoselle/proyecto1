import { AppShell } from "@/components/shared/app-shell";
import { requireRol } from "@/lib/session";

export default async function ClienteLayout({ children }: { children: React.ReactNode }) {
  const usuario = await requireRol("CLIENTE");
  return <AppShell usuario={usuario}>{children}</AppShell>;
}
