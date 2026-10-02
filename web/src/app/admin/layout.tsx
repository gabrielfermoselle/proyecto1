import { AppShell } from "@/components/shared/app-shell";
import { AdminNavInferior, AdminNavTabs } from "@/features/admin/components/admin-nav";
import { requireRol } from "@/lib/session";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const usuario = await requireRol("ADMIN");
  return (
    <AppShell usuario={usuario} nav={<AdminNavTabs />} mobileNav={<AdminNavInferior />}>
      {children}
    </AppShell>
  );
}
