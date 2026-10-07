import "server-only";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/shared/app-shell";
import { EmptyState } from "@/components/shared/empty-state";
import { CampanaNotificaciones } from "@/features/notificaciones/components/campana-notificaciones";
import { getNotificaciones } from "@/features/notificaciones/queries";
import { supabaseHabilitado } from "@/lib/supabase";
import type { UsuarioActual } from "@/lib/session";
import { MessagesSquare } from "lucide-react";
import { perfilChat } from "./acceso";
import { ChatProvider } from "./components/chat-provider";
import { ConversacionVista } from "./components/conversacion-vista";
import { MensajesLayout } from "./components/mensajes-layout";
import { contarNoLeidos, getVistaConversacion } from "./queries";

// Piezas de servidor que comparten las áreas de cliente y fletero.

/** Marco del área con el chat: provider (conexión en vivo + bandeja) y campana en el encabezado. */
export async function AreaConChat({
  usuario,
  nav,
  mobileNav,
  children,
}: {
  usuario: UsuarioActual;
  nav: React.ReactNode;
  mobileNav: React.ReactNode;
  children: React.ReactNode;
}) {
  const perfil = perfilChat(usuario);
  if (!perfil) throw new Error(`El usuario ${usuario.id} no tiene perfil de cliente ni de fletero`);
  const [noLeidos, notificaciones] = await Promise.all([
    contarNoLeidos(usuario),
    getNotificaciones(usuario.id),
  ]);
  return (
    <ChatProvider
      miUserId={usuario.id}
      miRol={perfil.rol}
      noLeidosInicial={noLeidos}
      notificacionesIniciales={notificaciones}
    >
      <AppShell usuario={usuario} nav={nav} mobileNav={mobileNav} headerExtra={<CampanaNotificaciones />}>
        {children}
      </AppShell>
    </ChatProvider>
  );
}

const TEXTO_VACIO = {
  CLIENTE: "Cuando un fletero te envíe un presupuesto, vas a poder hablar con él desde acá.",
  FLETERO: "Cuando envíes un presupuesto, se abre una conversación con el cliente para negociar.",
} as const;

export function LayoutMensajes({ rol, children }: { rol: "CLIENTE" | "FLETERO"; children: React.ReactNode }) {
  return (
    <MensajesLayout
      base={rol === "CLIENTE" ? "/cliente/mensajes" : "/fletero/mensajes"}
      textoVacio={TEXTO_VACIO[rol]}
    >
      {children}
    </MensajesLayout>
  );
}

/** En escritorio, el panel derecho cuando todavía no se eligió una conversación. */
export function SinConversacionElegida() {
  return (
    <div className="grid h-full place-items-center p-6">
      <EmptyState
        icon={<MessagesSquare />}
        title="Elegí una conversación"
        description="Tus chats con clientes y fleteros aparecen a la izquierda."
        className="border-0 bg-transparent"
      />
    </div>
  );
}

export async function PaginaConversacion({
  conversacionId,
  usuario,
}: {
  conversacionId: string;
  usuario: UsuarioActual;
}) {
  const vista = await getVistaConversacion(conversacionId, usuario);
  // Si no participa, la conversación "no existe" para él.
  if (!vista) notFound();
  const base = vista.meta.miRol === "CLIENTE" ? "/cliente/mensajes" : "/fletero/mensajes";
  return <ConversacionVista inicial={vista} fotosHabilitadas={supabaseHabilitado()} hrefBandeja={base} />;
}
