// Servidor de los e2e: PGlite con las migraciones + el seed de demo, y Next apuntando a esa base.
// Lo arranca Playwright (webServer). Con E2E_PROD=1 usa `next start` sobre un build previo (CI);
// si no, `next dev` (local, sin build).
import { spawn, type SpawnOptions } from "node:child_process";
import { levantarPglite } from "../db/pglite";

const PUERTO = process.env.E2E_PUERTO ?? "3100";

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
  };

  await esperar(npx(["tsx", "prisma/seed.ts"], { env: { ...env, NODE_ENV: "test" } }));

  const prod = process.env.E2E_PROD === "1";
  const next = npx(["next", prod ? "start" : "dev", "-p", PUERTO], { env });

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
