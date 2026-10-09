// Aplica el SQL de las migraciones y las funciones de la app. No usa Prisma.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import pg from "pg";

const ROLES = `
DO $$ BEGIN CREATE ROLE anon NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE ROLE authenticated NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE ROLE service_role NOLOGIN BYPASSRLS; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
`;

export async function aplicarSql(databaseUrl: string) {
  const cliente = new pg.Client({ connectionString: databaseUrl });
  await cliente.connect();
  try {
    const carpeta = join(process.cwd(), "prisma/migrations");
    for (const m of readdirSync(carpeta)
      .filter((d) => /^\d+_/.test(d))
      .sort()) {
      await cliente.query(readFileSync(join(carpeta, m, "migration.sql"), "utf8"));
    }
    await cliente.query(ROLES);
    await cliente.query(readFileSync(join(process.cwd(), "supabase/funciones.sql"), "utf8"));
  } finally {
    await cliente.end();
  }
}

export async function notificarPostgrest(databaseUrl: string) {
  const cliente = new pg.Client({ connectionString: databaseUrl });
  await cliente.connect();
  try {
    await cliente.query("NOTIFY pgrst, 'reload schema'");
  } finally {
    await cliente.end();
  }
}
