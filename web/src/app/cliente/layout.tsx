import { AreaConChat } from "@/features/chat/area";
import { ClienteNavInferior, ClienteNavTabs } from "@/features/clientes/components/cliente-nav";
import { requireRol } from "@/lib/session";

export default async function ClienteLayout({ children }: { children: React.ReactNode }) {
  const usuario = await requireRol("CLIENTE");
  return (
    <AreaConChat usuario={usuario} nav={<ClienteNavTabs />} mobileNav={<ClienteNavInferior />}>
      {children}
    </AreaConChat>
  );
}
