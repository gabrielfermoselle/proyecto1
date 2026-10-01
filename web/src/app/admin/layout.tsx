import { AppShell } from "@/components/shared/app-shell";
import { requireRol } from "@/lib/session";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const usuario = await requireRol("ADMIN");
  return <AppShell usuario={usuario}>{children}</AppShell>;
}
