import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const alias = { "@": fileURLToPath(new URL("./src", import.meta.url)) };

export default defineConfig({
  resolve: { alias },
  // tsconfig deja el JSX sin transformar (lo compila Next); en los tests lo transforma oxc.
  oxc: { jsx: { runtime: "automatic" } },
  test: {
    environment: "node",
    projects: [
      {
        extends: true,
        test: { name: "unit", include: ["src/**/*.test.ts"], exclude: ["src/**/*.db.test.ts"] },
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
