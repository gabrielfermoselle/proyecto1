import { expect, type Page } from "@playwright/test";

/** Contraseña de todas las cuentas del seed de demo (prisma/seed.ts). */
export const CLAVE_DEMO = "Demo1234";

/** Cuentas del seed usadas en los e2e, con el área a la que entra cada una. */
export const CUENTAS = {
  ana: { email: "ana@demo.test", area: "/cliente" },
  florencia: { email: "florencia@demo.test", area: "/cliente" },
  valeria: { email: "valeria@demo.test", area: "/cliente" },
  carlos: { email: "carlos@demo.test", area: "/fletero" },
  // Tiene un flete confirmado para mañana: su agenda muestra la grilla de la semana.
  soledad: { email: "soledad@demo.test", area: "/fletero" },
  lucia: { email: "lucia@demo.test", area: "/fletero" },
  admin: { email: "admin@demo.test", area: "/admin" },
} as const;

export type Cuenta = keyof typeof CUENTAS;

/** Sesión guardada por `sesiones.setup.ts`, para no pasar por el login en cada test. */
export const sesionDe = (cuenta: Cuenta) => `e2e/.auth/${cuenta}.json`;

export async function ingresar(page: Page, email: string, clave = CLAVE_DEMO) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Contraseña").fill(clave);
  await page.getByRole("button", { name: "Ingresar" }).click();
}

export async function ingresarComo(page: Page, cuenta: Cuenta) {
  await ingresar(page, CUENTAS[cuenta].email);
  await expect(page).toHaveURL(new RegExp(`${CUENTAS[cuenta].area}(/|$)`));
}
