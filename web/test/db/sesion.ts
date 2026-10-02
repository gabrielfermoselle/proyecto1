import type { UsuarioActual } from "@/lib/session";

/** Usuario "logueado" en el test (lo leen los mocks de @/lib/session). */
export const sesion: { actual: UsuarioActual | null } = { actual: null };

export function comoUsuario(usuario: UsuarioActual | null) {
  sesion.actual = usuario;
}
