import { expect, test, type Page } from "@playwright/test";

// Alta de cuentas por la interfaz. El servidor limita a 5 registros por hora por IP y todos los
// e2e salen de 127.0.0.1: este archivo crea solo dos cuentas.

const unico = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

async function completar(
  page: Page,
  datos: { rol: RegExp; email: string; clave: string; repetida?: string },
) {
  await page.goto("/registro");
  // Las tarjetas de rol son labels con un radio solo para lectores de pantalla: se toca la tarjeta.
  const rol = page.getByRole("radio", { name: datos.rol });
  await page.locator("label", { has: rol }).click();
  await expect(rol).toBeChecked();
  await page.getByLabel("Nombre").fill("Prueba");
  await page.getByLabel("Apellido").fill("Ensayo");
  await page.getByLabel("Email").fill(datos.email);
  await page.getByLabel("Contraseña", { exact: true }).fill(datos.clave);
  await page.getByLabel("Repetí la contraseña").fill(datos.repetida ?? datos.clave);
  await page.getByRole("button", { name: "Crear cuenta" }).click();
}

test("un cliente se registra y entra a su panel", async ({ page }) => {
  await completar(page, {
    rol: /Necesito un flete/,
    email: `  Cliente.${unico()}@E2E.test `,
    clave: "ClaveSegura1",
  });
  await expect(page).toHaveURL("/cliente");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Hola, Prueba");
});

test("un fletero se registra y arranca el onboarding", async ({ page }) => {
  await completar(page, { rol: /Soy fletero/, email: `fletero.${unico()}@e2e.test`, clave: "ClaveSegura1" });
  await expect(page).toHaveURL("/fletero/onboarding/datos");
  await expect(page.getByRole("heading", { name: "Configurá tu perfil de fletero" })).toBeVisible();
});

test("valida en el formulario sin crear la cuenta", async ({ page }) => {
  await completar(page, {
    rol: /Necesito un flete/,
    email: `no.${unico()}@e2e.test`,
    clave: "corta",
    repetida: "distinta",
  });
  await expect(page.getByText("Usá al menos 8 caracteres")).toBeVisible();
  await expect(page).toHaveURL("/registro");

  await page.getByLabel("Contraseña", { exact: true }).fill("ClaveSegura1");
  await page.getByLabel("Repetí la contraseña").fill("ClaveSegura2");
  await page.getByRole("button", { name: "Crear cuenta" }).click();
  await expect(page.getByText("Las contraseñas no coinciden")).toBeVisible();
  await expect(page).toHaveURL("/registro");
});

test("un email ya registrado no crea otra cuenta", async ({ page }) => {
  await completar(page, { rol: /Necesito un flete/, email: "ANA@demo.test", clave: "ClaveSegura1" });
  await expect(page.getByRole("alert").filter({ hasText: /email/i })).toBeVisible();
  await expect(page).toHaveURL("/registro");
});
