import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const alias = { "@": fileURLToPath(new URL("./src", import.meta.url)) };

// [FUERA-S3] Tests de lo que queda fuera de los sprints 1-3: los archivos siguen en el repo, comentados.
const FUERA_S3 = [
  "src/features/chat/hilo.test.ts",
  "src/features/chat/bandeja.integration.test.ts",
  "src/features/chat/chat.db.test.ts",
  "src/features/clientes/fleteros/buscador.db.test.ts",
  "src/features/clientes/fleteros/buscador.integration.test.ts",
  "src/features/clientes/fleteros/parametros.test.ts",
  "src/features/clientes/perfil/perfil-cliente.db.test.ts",
];

export default defineConfig({
  resolve: { alias },
  // tsconfig deja el JSX sin transformar (lo compila Next); en los tests lo transforma oxc.
  oxc: { jsx: { runtime: "automatic" } },
  test: {
    environment: "node",
    projects: [
      {
        extends: true,
        test: { name: "unit", include: ["src/**/*.test.ts"], exclude: ["src/**/*.db.test.ts", ...FUERA_S3] },
      },
      {
        // Integración con Prisma contra una base real (PGlite por TCP, ver test/db/global-setup).
        extends: true,
        resolve: {
          alias: {
            ...alias,
            "server-only": fileURLToPath(new URL("./test/db/server-only.ts", import.meta.url)),
          },
        },
        test: {
          name: "db",
          include: ["src/**/*.db.test.ts"],
          exclude: FUERA_S3,
          globalSetup: ["./test/db/global-setup.ts"],
          setupFiles: ["./test/db/setup.ts"],
          // Una sola base compartida: los archivos corren de a uno.
          fileParallelism: false,
          testTimeout: 60_000,
          hookTimeout: 120_000,
        },
      },
    ],
  },
});
