import { defineConfig, devices } from "@playwright/test";

// e2e contra la app real: Next + PGlite con el seed de demo (ver test/e2e/servidor.ts). La base
// es una sola y los recorridos la modifican, así que corren en serie y en un orden fijo.
const PUERTO = Number(process.env.E2E_PUERTO ?? 3100);
const baseURL = `http://localhost:${PUERTO}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  // Sin reintentos: un recorrido que ya cambió la base no se puede repetir igual.
  retries: 0,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : [["list"]],
  use: {
    baseURL,
    locale: "es-AR",
    timezoneId: "America/Argentina/Tucuman",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "sesiones", testMatch: /sesiones\.setup\.ts/ },
    {
      name: "escritorio",
      use: { ...devices["Desktop Chrome"] },
      dependencies: ["sesiones"],
    },
    {
      // Mobile first: la navegación y la accesibilidad también se prueban en un teléfono.
      name: "movil",
      use: { ...devices["Pixel 7"] },
      dependencies: ["escritorio"],
      testMatch: /(navegacion|accesibilidad)\.spec\.ts/,
    },
  ],
  webServer: {
    command: "npx tsx test/e2e/servidor.ts",
    url: `${baseURL}/login`,
    env: { E2E_PUERTO: String(PUERTO) },
    // `next dev` compila cada ruta la primera vez que se pide.
    timeout: 300_000,
    reuseExistingServer: false,
    stdout: "pipe",
  },
});
