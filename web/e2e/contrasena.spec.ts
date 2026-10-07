import { expect, test, type Page } from "@playwright/test";
import { ingresar } from "./utils";

// Cambio de contraseña con una cuenta nueva (no se toca ninguna cuenta del seed: sus sesiones
// guardadas las usan los demás e2e). El servidor limita a 5 registros por hora por IP.

const email = `clave.${Date.now().toString(36)}@e2e.test`;
const CLAVE = "ClaveSegura1";
const NUEVA = "OtraClave22";

test.describe.configure({ mode: "serial" });

async function registrar(page: Page) {
  await page.goto("/registro");
  const rol = page.getByRole("radio", { name: /Necesito un flete/ });
  await page.locator("label", { has: rol }).click();
  await page.getByLabel("Nombre").fill("Clara");
  await page.getByLabel("Apellido").fill("Prueba");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Contraseña", { exact: true }).fill(CLAVE);
  await page.getByLabel("Repetí la contraseña").fill(CLAVE);
  await page.getByRole("button", { name: "Crear cuenta" }).click();
  await expect(page).toHaveURL("/cliente");
}

test("cambiar la contraseña cierra las sesiones abiertas y se entra con la nueva", async ({ browser }) => {
  const otroDispositivo = await browser.newPage();
  await registrar(otroDispositivo);

  const page = await browser.newPage();
  await ingresar(page, email, CLAVE);
  await expect(page).toHaveURL("/cliente");

  await page.goto("/cliente/perfil");
  await page.getByLabel("Contraseña actual").fill(CLAVE);
  await page.getByLabel("Contraseña nueva").fill(NUEVA);
  await page.getByLabel("Repetí la nueva").fill(NUEVA);
  await page.getByRole("button", { name: "Cambiar contraseña" }).click();

  await expect(page).toHaveURL(/\/login\?aviso=contrasena/);
  await expect(page.getByText("Cambiaste tu contraseña y cerramos tus sesiones")).toBeVisible();

  // La sesión del otro dispositivo (iniciada antes del cambio) ya no vale.
  await otroDispositivo.goto("/cliente/perfil");
  await expect(otroDispositivo).toHaveURL(/\/login/);

  await ingresar(page, email, CLAVE);
  await expect(page.getByText("El email o la contraseña no son correctos.")).toBeVisible();
  await ingresar(page, email, NUEVA);
  await expect(page).toHaveURL("/cliente");
});
