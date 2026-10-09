import { MarcoDelUsuario } from "@/features/areas/marcos";

/** Chat, notificaciones y cuenta: comunes a los roles, cada uno con su marco. */
export default function ComunLayout({ children }: { children: React.ReactNode }) {
  return <MarcoDelUsuario>{children}</MarcoDelUsuario>;
}
