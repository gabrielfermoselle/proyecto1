import "server-only";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { cache } from "react";
import { AREA_POR_ROL, type Rol } from "@/domain/roles";
import { sesionVigente } from "@/domain/sesion";
import { authOptions } from "./auth";
import { prisma } from "./prisma";

/**
 * Usuario de la sesión, leído de la base (no solo del JWT): si un admin lo desactiva o le
 * cambia el rol, se aplica en el próximo request; si cambió la contraseña, las sesiones
 * anteriores dejan de valer. `cache` evita repetir la query en un render.
 */
export const getUsuarioActual = cache(async () => {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      email: true,
      nombre: true,
      apellido: true,
      rol: true,
      activo: true,
      credencialesCambiadasEn: true,
      clienteProfile: { select: { id: true } },
      fleteroProfile: { select: { id: true, onboardingCompletadoEn: true } },
    },
  });
  if (!user?.activo) return null;
  const { credencialesCambiadasEn, ...usuario } = user;
  return sesionVigente(session.autenticadoEn, credencialesCambiadasEn) ? usuario : null;
});

export type UsuarioActual = NonNullable<Awaited<ReturnType<typeof getUsuarioActual>>>;

/** Para páginas y layouts: si no hay sesión, al login. */
export async function requireUsuario(): Promise<UsuarioActual> {
  const usuario = await getUsuarioActual();
  if (!usuario) redirect("/login");
  return usuario;
}

/** Para páginas y layouts: si el rol no corresponde, a su propia área. */
export async function requireRol(...roles: readonly Rol[]): Promise<UsuarioActual> {
  const usuario = await requireUsuario();
  if (!roles.includes(usuario.rol)) redirect(AREA_POR_ROL[usuario.rol]);
  return usuario;
}

/** Para el área del cliente. Devuelve su `clienteId`, que toda query debe usar como filtro. */
export async function requireCliente() {
  const usuario = await requireRol("CLIENTE");
  const perfil = usuario.clienteProfile;
  if (!perfil) throw new Error(`El usuario ${usuario.id} es CLIENTE pero no tiene perfil`);
  return { usuario, clienteId: perfil.id };
}

/**
 * Para el área del fletero. Devuelve su `fleteroId`, que toda query debe usar como filtro.
 * Si el onboarding no está completo, manda a terminarlo (salvo en las páginas del onboarding).
 */
export async function requireFletero({ permitirOnboardingIncompleto = false } = {}) {
  const usuario = await requireRol("FLETERO");
  const perfil = usuario.fleteroProfile;
  if (!perfil) throw new Error(`El usuario ${usuario.id} es FLETERO pero no tiene perfil`);
  if (!permitirOnboardingIncompleto && !perfil.onboardingCompletadoEn) redirect("/fletero/onboarding");
  return { usuario, fleteroId: perfil.id, onboardingCompleto: perfil.onboardingCompletadoEn !== null };
}
