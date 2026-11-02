import "server-only";
import { AppShell } from "@/components/shared/app-shell";
import { AdminNavInferior, AdminNavTabs } from "@/features/admin/components/admin-nav";
import { AreaConChat } from "@/features/chat/area";
import {
  BotonNuevoPedido,
  ClienteNavInferior,
  ClienteNavTabs,
} from "@/features/clientes/components/cliente-nav";
import { FleteroNavInferior, FleteroNavTabs } from "@/features/fleteros/components/fletero-nav";
import { requireFletero, requireRol, requireUsuario, type UsuarioActual } from "@/lib/session";

// El marco (toldo, navegación y chat en vivo) de cada rol. Lo usan los layouts de cada área y el
// de las secciones comunes (chat, notificaciones, perfil), que elige según quién entra.

function Cliente({ usuario, children }: { usuario: UsuarioActual; children: React.ReactNode }) {
  return (
    <AreaConChat
      usuario={usuario}
      nav={<ClienteNavTabs />}
      mobileNav={<ClienteNavInferior />}
      accionPrincipal={<BotonNuevoPedido />}
    >
      {children}
    </AreaConChat>
  );
}

function Fletero({ usuario, children }: { usuario: UsuarioActual; children: React.ReactNode }) {
  return (
    <AreaConChat usuario={usuario} nav={<FleteroNavTabs />} mobileNav={<FleteroNavInferior />}>
      {children}
    </AreaConChat>
  );
}

function Admin({ usuario, children }: { usuario: UsuarioActual; children: React.ReactNode }) {
  return (
    <AppShell usuario={usuario} nav={<AdminNavTabs />} mobileNav={<AdminNavInferior />}>
      {children}
    </AppShell>
  );
}

export async function MarcoCliente({ children }: { children: React.ReactNode }) {
  const usuario = await requireRol("CLIENTE");
  return <Cliente usuario={usuario}>{children}</Cliente>;
}

/** Área del fletero con el onboarding completo (si no, lo manda a terminarlo). */
export async function MarcoFletero({ children }: { children: React.ReactNode }) {
  const { usuario } = await requireFletero();
  return <Fletero usuario={usuario}>{children}</Fletero>;
}

export async function MarcoAdmin({ children }: { children: React.ReactNode }) {
  const usuario = await requireRol("ADMIN");
  return <Admin usuario={usuario}>{children}</Admin>;
}

/** Secciones comunes: el marco del rol de quien entra. */
export async function MarcoDelUsuario({ children }: { children: React.ReactNode }) {
  const usuario = await requireUsuario();
  if (usuario.rol === "CLIENTE") return <Cliente usuario={usuario}>{children}</Cliente>;
  if (usuario.rol === "FLETERO") {
    const { usuario: fletero } = await requireFletero();
    return <Fletero usuario={fletero}>{children}</Fletero>;
  }
  return <Admin usuario={usuario}>{children}</Admin>;
}
