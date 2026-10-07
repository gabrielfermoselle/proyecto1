import { expect, test } from "@playwright/test";
import { sesionDe } from "./utils";

// Buscador de fleteros del cliente: cercanía desde la dirección habitual, una solicitud como
// referencia (precio estimado) y filtros que vacían la lista.

test.use({ storageState: sesionDe("ana") });

test("por defecto mide la distancia desde la dirección habitual", async ({ page }) => {
  await page.goto("/cliente/fleteros");
  await expect(page.getByRole("radio", { name: "Mi dirección habitual" })).toBeChecked();
  await expect(page.getByText(/fleteros? cerca de/)).toBeVisible();
  await expect(page.getByText(/^A [\d,]+ (km|m)$/).first()).toBeVisible();
});

test("con una solicitud de referencia muestra el precio estimado y ordena por precio", async ({ page }) => {
  await page.goto("/cliente/fleteros");
  await page.getByRole("radio", { name: "Una de mis solicitudes" }).check();
  await page.getByLabel("Ordenar por").selectOption("precio");
  await page.getByRole("button", { name: "Buscar" }).click();

  await expect(page).toHaveURL(/ref=solicitud/);
  await expect(page.getByText("Estimado").first()).toBeVisible();

  const montos = await page
    .locator("li")
    .filter({ hasText: "Estimado" })
    .locator(".tabular-nums")
    .allTextContents();
  const numeros = montos.map((m) => Number(m.replace(/\D/g, "")));
  expect(numeros).toEqual([...numeros].sort((a, b) => a - b));
});

test("un tope de precio imposible deja la lista vacía", async ({ page }) => {
  await page.goto("/cliente/fleteros?precioMax=1&radio=todos");
  await expect(page.getByRole("heading", { name: "No hay fleteros con esos filtros" })).toBeVisible();
});
