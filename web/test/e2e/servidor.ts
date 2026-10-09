// Servidor de los e2e: PGlite con las migraciones + el seed de demo, y Next apuntando a esa base.
// Lo arranca Playwright (webServer). Con E2E_PROD=1 usa `next start` sobre un build previo (CI);
// si no, `next dev` (local, sin build). También es `npm run dev:local` (con --puerto 3000): la app
// contra una base en memoria con los datos de demo, sin la latencia de Supabase. Los datos se
// regeneran cada vez que arranca.
import { spawn, type SpawnOptions } from "node:child_process";
import { rmSync } from "node:fs";
import { levantarPglite } from "../db/pglite";
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
  const { url, cerrar } = await levantarPglite();
  const env = {
    ...process.env,
    DATABASE_URL: url,
    DIRECT_URL: url,
    NEXTAUTH_URL: `http://localhost:${PUERTO}`,
    NEXTAUTH_SECRET: "secreto-de-e2e-con-mas-de-32-caracteres",
    // Sin Supabase: el chat por consultas periódicas y sin carga de fotos.
    SUPABASE_URL: "",
    SUPABASE_ANON_KEY: "",
    SUPABASE_SERVICE_ROLE_KEY: "",
    SUPABASE_JWT_SECRET: "",
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

  const terminar = async () => {
    next.kill();
    await cerrar();
    process.exit(0);
  };
  process.on("SIGINT", terminar);
  process.on("SIGTERM", terminar);
  next.on("exit", async (codigo) => {
    await cerrar();
    process.exit(codigo ?? 1);
  });
}

main().catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});
