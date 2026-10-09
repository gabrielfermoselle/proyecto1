// Tests de integración contra Postgres + PostgREST. La app entra por el cliente de Supabase.
import { aplicarSql } from "./sql";
import { publicarSupabaseDePrueba } from "./puente-supabase";

const SECRETO_TEST = "secreto-de-test-con-mas-de-32-caracteres";

function afirmarBaseDePrueba(url: string) {
  const { hostname, pathname } = new URL(url);
  if (!["localhost", "127.0.0.1", "postgres"].includes(hostname) || !/test/i.test(pathname)) {
    throw new Error(
      `TEST_DATABASE_URL tiene que apuntar a una base local cuyo nombre incluya "test" (llegó ${hostname}${pathname}). ` +
        "Los tests borran todo.",
    );
  }
}

export default async function setup() {
  const url = process.env.TEST_DATABASE_URL;
  if (!url || !process.env.POSTGREST_URL) {
    throw new Error("Los tests de integración necesitan TEST_DATABASE_URL y POSTGREST_URL.");
  }
  afirmarBaseDePrueba(url);
  await aplicarSql(url);
  Object.assign(process.env, {
    DATABASE_URL: url,
    NEXTAUTH_SECRET: SECRETO_TEST,
    NODE_ENV: "test",
    TEST_BASE: "postgres",
  });
  const puente = await publicarSupabaseDePrueba(url);
  return () => puente.cerrar();
}
