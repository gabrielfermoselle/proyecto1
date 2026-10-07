import type { UsuarioActual } from "@/lib/session";

/** Usuario "logueado" en el test (lo leen los mocks de @/lib/session). */
export const sesion: { actual: UsuarioActual | null } = { actual: null };

export function comoUsuario(usuario: UsuarioActual | null) {
  sesion.actual = usuario;
}

/**
 * La suite corre contra un Postgres real (TEST_DATABASE_URL, en el CI) y no contra PGlite.
 * Usar con `it.runIf(conPostgresReal)` en tests de concurrencia o de errores de la base fuera
 * de una transacción, que PGlite no reproduce.
 */
export const conPostgresReal = process.env.TEST_BASE === "postgres";
