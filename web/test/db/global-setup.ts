// Base de datos real para los tests de integración (*.db.test.ts). Dos modos:
//  - Por defecto, PGlite + PostGIS con todas las migraciones, expuesta por TCP para que Prisma se
//    conecte como a Postgres. Rápido y sin instalar nada.
//  - Con TEST_DATABASE_URL, un Postgres + PostGIS de verdad (el CI usa un contenedor). PGlite es una
//    sola sesión: no reproduce la concurrencia ni los errores de una consulta fuera de transacción,
//    así que los tests que dependen de eso corren solo en este modo (ver `conPostgresReal`).
import { execSync } from "node:child_process";
import { levantarPglite } from "./pglite";

const SECRETO_TEST = "secreto-de-test-con-mas-de-32-caracteres";

/** Aplica las migraciones desde cero sobre un Postgres real. Se niega a tocar una base que no sea de test. */
function prepararPostgresReal(url: string) {
  const { hostname, pathname } = new URL(url);
  if (!["localhost", "127.0.0.1", "postgres"].includes(hostname) || !/test/i.test(pathname)) {
    throw new Error(
      `TEST_DATABASE_URL tiene que apuntar a una base local cuyo nombre incluya "test" (llegó ${hostname}${pathname}). ` +
        "Los tests borran todo.",
    );
  }
  execSync("npx prisma migrate reset --force --skip-seed --skip-generate", {
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: url, DIRECT_URL: url },
  });
  Object.assign(process.env, {
    DATABASE_URL: url,
    DIRECT_URL: url,
    NEXTAUTH_SECRET: SECRETO_TEST,
    NODE_ENV: "test",
    TEST_BASE: "postgres",
  });
  return async () => undefined;
}

export default async function setup() {
  const externa = process.env.TEST_DATABASE_URL;
  if (externa) return prepararPostgresReal(externa);

  const { url, cerrar } = await levantarPglite();
  // Los workers de Vitest heredan estas variables (lib/env las valida al importarse).
  Object.assign(process.env, {
    DATABASE_URL: url,
    DIRECT_URL: url,
    NEXTAUTH_SECRET: SECRETO_TEST,
    NODE_ENV: "test",
    TEST_BASE: "pglite",
  });

  return cerrar;
}
