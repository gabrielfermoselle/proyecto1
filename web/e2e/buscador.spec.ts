import { expect, test } from "@playwright/test";
import { ingresar, sesionDe } from "./utils";

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

  // Un monto por tarjeta: el precio estimado. Si el locator agarra un li de más, el mismo
  // número entra dos veces y el orden deja de verse ordenado.
  const montos = await page
    .getByRole("main")
    .locator("ul")
    .filter({ hasText: "Estimado" })
    .first()
    .locator("> li")
    .evaluateAll((tarjetas) =>
      tarjetas.map((li) =>
        Number((li.querySelector(".tabular-nums")?.textContent ?? "").replace(/\D/g, "")),
      ),
    );
  expect(montos.length).toBeGreaterThan(1);
  expect(montos).toEqual([...montos].sort((a, b) => a - b));
});

test("un tope de precio imposible deja la lista vacía", async ({ page }) => {
  await page.goto("/cliente/fleteros?precioMax=1&radio=todos");
  await expect(page.getByRole("heading", { name: "No hay fleteros con esos filtros" })).toBeVisible();
});

test.describe("sin dirección habitual", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("le pide cargarla y lista a los fleteros sin distancia", async ({ page }) => {
    await ingresar(page, "paula@demo.test");
    await expect(page).toHaveURL("/cliente");
    await page.goto("/cliente/fleteros");
    const cerca = page.getByRole("group", { name: "Buscar cerca de" });
    await expect(cerca.getByText("Todavía no cargaste tu dirección.")).toBeVisible();
    await expect(cerca.getByRole("link", { name: "Cargala en tu perfil" })).toHaveAttribute(
      "href",
      "/perfil#direccion",
    );
    await expect(page.getByText(/^Desde \$/).first()).toBeVisible();
    await expect(page.getByText(/^A [\d,]+ (km|m)$/)).toHaveCount(0);
  });
});
