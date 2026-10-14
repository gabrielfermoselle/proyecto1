// [FUERA-S3] [FE] Pantalla del chat. Fuera de los sprints 1-3: el código original queda comentado abajo.
export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}

// import { LayoutMensajes } from "@/features/chat/area";
// import { requireRol } from "@/lib/session";
//
// export default async function ChatLayout({ children }: { children: React.ReactNode }) {
//   const usuario = await requireRol("CLIENTE", "FLETERO");
//   return <LayoutMensajes rol={usuario.rol === "CLIENTE" ? "CLIENTE" : "FLETERO"}>{children}</LayoutMensajes>;
// }
