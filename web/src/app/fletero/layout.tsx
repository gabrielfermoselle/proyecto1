import { requireRol } from "@/lib/session";

/** Solo fleteros. Cada grupo (onboarding / app) arma su propio marco. */
export default async function FleteroLayout({ children }: { children: React.ReactNode }) {
  await requireRol("FLETERO");
  return children;
}
