import { AreaConChat } from "@/features/chat/area";
import { FleteroNavInferior, FleteroNavTabs } from "@/features/fleteros/components/fletero-nav";
import { requireFletero } from "@/lib/session";

/** Área del fletero con el onboarding completo. */
export default async function FleteroAppLayout({ children }: { children: React.ReactNode }) {
  const { usuario } = await requireFletero();
  return (
    <AreaConChat usuario={usuario} nav={<FleteroNavTabs />} mobileNav={<FleteroNavInferior />}>
      {children}
    </AreaConChat>
  );
}
