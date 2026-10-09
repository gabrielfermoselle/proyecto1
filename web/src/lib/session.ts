import "server-only";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { cache } from "react";
import { AREA_POR_ROL, type Rol } from "@/domain/roles";
import { sesionVigente } from "@/domain/sesion";
import { authOptions } from "./auth";
import { db, fallar, relacion } from "./db";

/**
 * Usuario de la sesión, leído de la base (no solo del JWT): si un admin lo desactiva o le
 * cambia el rol, se aplica en el próximo request; si cambió la contraseña, las sesiones
 * anteriores dejan de valer. `cache` evita repetir la query en un render.
 */
export const getUsuarioActual = cache(async () => {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;

  const { data, error } = await db()
    .from("usuarios")
    .select(
      "id, email, nombre, apellido, rol, activo, credencialesCambiadasEn, perfiles_cliente(id), perfiles_fletero(id, onboardingCompletadoEn)",
    )
    .eq("id", session.user.id)
    .maybeSingle();
  fallar(error);
  if (!data?.activo) return null;

  const user = {
    id: data.id as string,
    email: data.email as string,
    nombre: data.nombre as string,
    apellido: data.apellido as string,
    rol: data.rol as Rol,
    activo: data.activo as boolean,
    clienteProfile: relacion(data.perfiles_cliente as { id: string } | { id: string }[] | null),
    fleteroProfile: relacion(
      data.perfiles_fletero as
        | { id: string; onboardingCompletadoEn: string | null }
        | { id: string; onboardingCompletadoEn: string | null }[]
        | null,
    ),
  };
  const credencialesCambiadasEn = data.credencialesCambiadasEn
    ? new Date(data.credencialesCambiadasEn as string)
    : null;
  return sesionVigente(session.autenticadoEn, credencialesCambiadasEn) ? user : null;
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
