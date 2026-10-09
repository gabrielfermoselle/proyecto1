import "server-only";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AppShell } from "@/components/shared/app-shell";
import { EmptyState } from "@/components/shared/empty-state";
import { CampanaNotificaciones } from "@/features/notificaciones/components/campana-notificaciones";
import { getNotificaciones } from "@/features/notificaciones/queries";
import { nombrePublico } from "@/lib/formato";
import { prisma } from "@/lib/prisma";
import { supabaseHabilitado } from "@/lib/supabase";
import type { UsuarioActual } from "@/lib/session";
import { MessagesSquare } from "lucide-react";
import { hrefConversacion, perfilChat } from "./acceso";
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
  accionPrincipal,
  children,
}: {
  usuario: UsuarioActual;
  nav: React.ReactNode;
  mobileNav: React.ReactNode;
  accionPrincipal?: React.ReactNode;
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
      <AppShell
        usuario={usuario}
        nav={nav}
        mobileNav={mobileNav}
        accionPrincipal={accionPrincipal}
        headerExtra={<CampanaNotificaciones />}
      >
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
    <MensajesLayout base="/chat" textoVacio={TEXTO_VACIO[rol]}>
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
  return <ConversacionVista inicial={vista} fotosHabilitadas={supabaseHabilitado()} hrefBandeja="/chat" />;
}

/** Conversaciones de un pedido que ve el usuario: una para el fletero, una por fletero para el cliente. */
async function conversacionesDelPedido(solicitudId: string, usuario: UsuarioActual) {
  const perfil = perfilChat(usuario);
  if (!perfil) return [];
  return prisma.conversacion.findMany({
    where: {
      solicitudId,
      ...(perfil.rol === "CLIENTE" ? { clienteId: perfil.perfilId } : { fleteroId: perfil.perfilId }),
    },
    orderBy: { ultimaActividadEn: "desc" },
    select: {
      id: true,
      fleteroId: true,
      solicitud: { select: { titulo: true } },
      fletero: { select: { user: { select: { nombre: true, apellido: true } } } },
    },
  });
}

/**
 * `/chat/:pedidoId`. El fletero entra directo a su conversación; el cliente, si le escribió un solo
 * fletero, también; si fueron varios, elige con quién.
 */
export async function PaginaChatDelPedido({
  solicitudId,
  usuario,
}: {
  solicitudId: string;
  usuario: UsuarioActual;
}) {
  const conversaciones = await conversacionesDelPedido(solicitudId, usuario);
  if (conversaciones.length === 0) notFound();
  if (usuario.rol === "FLETERO") {
    return <PaginaConversacion conversacionId={conversaciones[0]!.id} usuario={usuario} />;
  }
  if (conversaciones.length === 1)
    redirect(hrefConversacion("CLIENTE", solicitudId, conversaciones[0]!.fleteroId));
  return (
    <div className="grid h-full content-start gap-4 p-4 sm:p-6">
      <div className="grid gap-1">
        <h1 className="text-xl font-bold">{conversaciones[0]!.solicitud.titulo}</h1>
        <p className="text-muted-foreground">Elegí con qué fletero querés hablar.</p>
      </div>
      <ul className="grid gap-2">
        {conversaciones.map((c) => {
          const nombre = nombrePublico(c.fletero.user.nombre, c.fletero.user.apellido);
          return (
            <li key={c.id}>
              <Link
                href={hrefConversacion("CLIENTE", solicitudId, c.fleteroId)}
                className="flex items-center gap-3 rounded-lg border bg-card p-3 font-semibold transition-colors hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="grid size-10 place-items-center rounded-full bg-secondary font-heading font-extrabold text-secondary-foreground">
                  {nombre.charAt(0)}
                </span>
                {nombre}
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** `/chat/:pedidoId/:fleteroId`: la conversación del cliente con ese fletero. */
export async function PaginaChatConFletero({
  solicitudId,
  fleteroId,
  usuario,
}: {
  solicitudId: string;
  fleteroId: string;
  usuario: UsuarioActual;
}) {
  if (usuario.rol !== "CLIENTE") notFound();
  const conversaciones = await conversacionesDelPedido(solicitudId, usuario);
  const conversacion = conversaciones.find((c) => c.fleteroId === fleteroId);
  if (!conversacion) notFound();
  return <PaginaConversacion conversacionId={conversacion.id} usuario={usuario} />;
}
