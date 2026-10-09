import { MarcoCliente } from "@/features/areas/marcos";

export default function ClienteLayout({ children }: { children: React.ReactNode }) {
  return <MarcoCliente>{children}</MarcoCliente>;
}
