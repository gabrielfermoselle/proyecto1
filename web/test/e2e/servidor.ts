// Servidor de los e2e: Postgres de prueba + PostgREST, el seed de demo y Next.
// Lo arranca Playwright. Con E2E_PROD=1 usa `next start` sobre un build previo (CI).
import { spawn, type SpawnOptions } from "node:child_process";
import { rmSync } from "node:fs";
import { publicarSupabaseDePrueba } from "../db/puente-supabase";
import { aplicarSql } from "../db/sql";
import { ARCHIVO_CORREOS } from "./correos";

const argPuerto = process.argv.indexOf("--puerto");
const PUERTO = (argPuerto >= 0 ? process.argv[argPuerto + 1] : undefined) ?? process.env.E2E_PUERTO ?? "3100";

/** `npx …` como proceso hijo. Nunca sincrónico: PGlite atiende las consultas en este mismo proceso. */
function npx(args: string[], opciones: SpawnOptions) {
  return spawn("npx", args, { stdio: "inherit", shell: process.platform === "win32", ...opciones });
}

function esperar(hijo: ReturnType<typeof npx>): Promise<void> {
  return new Promise((resolve, reject) =>
    hijo.on("exit", (codigo) =>
      codigo === 0 ? resolve() : reject(new Error(`El seed salió con código ${codigo}`)),
    ),
  );
}

async function main() {
  const url = process.env.TEST_DATABASE_URL;
  if (!url || !process.env.POSTGREST_URL) {
    throw new Error("Los e2e necesitan TEST_DATABASE_URL y POSTGREST_URL.");
  }
  await aplicarSql(url);
  await publicarSupabaseDePrueba(url);
  const env = {
    ...process.env,
    DATABASE_URL: url,
    NEXTAUTH_URL: `http://localhost:${PUERTO}`,
    NEXTAUTH_SECRET: "secreto-de-e2e-con-mas-de-32-caracteres",
    SUPABASE_URL: process.env.SUPABASE_URL || "",
    SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY || "",
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || "",
    SUPABASE_JWT_SECRET: process.env.SUPABASE_JWT_SECRET || "",
    // Sin Resend: los emails van a un archivo que leen los tests.
    RESEND_API_KEY: "",
    CORREO_ARCHIVO: ARCHIVO_CORREOS,
  };
  rmSync(ARCHIVO_CORREOS, { force: true });

  await esperar(npx(["tsx", "prisma/seed.ts"], { env: { ...env, NODE_ENV: "test" } }));

  const prod = process.env.E2E_PROD === "1";
  // En desarrollo, Turbopack: compila cada página mucho más rápido que webpack.
  const next = npx(prod ? ["next", "start", "-p", PUERTO] : ["next", "dev", "--turbopack", "-p", PUERTO], {
    env,
  });

  const terminar = () => {
    next.kill();
    process.exit(0);
  };
  process.on("SIGINT", terminar);
  process.on("SIGTERM", terminar);
  next.on("exit", (codigo) => {
    process.exit(codigo ?? 1);
  });
}

main().catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});
