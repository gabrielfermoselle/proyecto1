import { expect, test } from "@playwright/test";
import { CUENTAS, sesionDe } from "./utils";

// Recorridos por el resto de la app que no cubren los otros archivos: los enlaces públicos, el
// 404, las API protegidas, el perfil público de un fletero, las pestañas del admin y la validación
// del primer paso del pedido. Ninguno modifica la base: no dependen del orden de los demás.

test.describe("sin sesión", () => {
  test("el login enlaza a recuperar la contraseña y al registro, y se puede volver", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Ingresá a tu cuenta");

    await page.getByRole("link", { name: "¿Olvidaste tu contraseña?" }).click();
    await expect(page).toHaveURL("/recuperar");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("¿Olvidaste tu contraseña?");

    await page.goto("/login");
    await page.getByRole("link", { name: "Registrate" }).click();
    await expect(page).toHaveURL(/\/registro/);
    await expect(page.getByRole("heading", { name: "Creá tu cuenta" })).toBeVisible();
  });

  test("una dirección que no existe muestra el 404 con un enlace al inicio", async ({ page }) => {
    const respuesta = await page.goto("/esta-pagina-no-existe");
    expect(respuesta?.status()).toBe(404);
    await expect(page.getByRole("heading", { name: "No encontramos esa página" })).toBeVisible();

    await page.getByRole("link", { name: "Ir al inicio" }).click();
    await expect(page).toHaveURL("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("¿Qué necesitás mover?");
  });

  test("el perfil público de un fletero que no existe da 404", async ({ page }) => {
    const respuesta = await page.goto("/fleteros/no-existe-este-fletero");
    expect(respuesta?.status()).toBe(404);
    await expect(page.getByRole("heading", { name: "No encontramos esa página" })).toBeVisible();
  });

  test("las API privadas responden 401 sin sesión y no se cachean", async ({ request }) => {
    for (const ruta of ["/api/notificaciones", "/api/chat/bandeja", "/api/fletes/cualquiera/comprobante"]) {
      const r = await request.get(ruta);
      expect(r.status(), ruta).toBe(401);
      expect(await r.json(), ruta).toEqual({ error: "Tu sesión expiró." });
      expect(r.headers()["cache-control"], ruta).toContain("no-store");
    }
  });

  test("el mantenimiento diario rechaza a quien no trae el secreto del cron", async ({ request }) => {
    const sinHeader = await request.get("/api/cron/mantenimiento");
    expect(sinHeader.status()).toBe(401);
    const conOtro = await request.get("/api/cron/mantenimiento", {
      headers: { authorization: "Bearer cualquier-cosa" },
    });
    expect(conOtro.status()).toBe(401);
    expect(await conOtro.json()).toEqual({ error: "No autorizado." });
  });
});

test.describe("como cliente", () => {
  test.use({ storageState: sesionDe("ana") });

  test("Mi cuenta muestra con qué email entra", async ({ page }) => {
    await page.goto("/perfil");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Mi cuenta");
    await expect(page.getByText(`Entrás con ${CUENTAS.ana.email}.`)).toBeVisible();
  });

  test("las notificaciones se ven en la página y en la API con la misma cuenta de no leídas", async ({
    page,
  }) => {
    const api = await page.request.get("/api/notificaciones");
    expect(api.status()).toBe(200);
    const datos = (await api.json()) as { items: unknown[]; noLeidas: number };
    expect(Array.isArray(datos.items)).toBe(true);
    expect(typeof datos.noLeidas).toBe("number");

    await page.goto("/notificaciones");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Notificaciones");
    await expect(
      page.getByText(datos.noLeidas > 0 ? `Tenés ${datos.noLeidas} sin leer.` : "Estás al día."),
    ).toBeVisible();
  });

  test("desde el buscador abre el perfil público de un fletero con sus reseñas", async ({ page }) => {
    await page.goto("/cliente/fleteros");
    await page.locator("#contenido").getByRole("link", { name: /Carlos R\./ }).first().click();
    await expect(page).toHaveURL(/\/fleteros\/[^/?]+$/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Carlos R.");
    await expect(page.getByRole("heading", { level: 2, name: "Reseñas" })).toBeVisible();
    await expect(page.getByText(/\d+ fletes completados/)).toBeVisible();
  });

  test("el comprobante de un flete ajeno o inexistente da 404", async ({ page }) => {
    const r = await page.request.get("/api/fletes/no-existe/comprobante");
    expect(r.status()).toBe(404);
    expect(await r.json()).toEqual({ error: "No encontrado." });
  });

  test("el pedido nuevo no avanza sin elegir el tipo de flete y avanza al elegirlo", async ({ page }) => {
    await page.goto("/cliente/nuevo");
    const contenido = page.locator("#contenido");
    await expect(contenido.getByRole("heading", { level: 2, name: "1. Tipo" })).toBeVisible();

    // Antes de hidratar, «Siguiente» no valida: se repite hasta que aparezca el error.
    const error = contenido.getByText("Elegí qué tipo de flete es");
    await expect(async () => {
      await contenido.getByRole("button", { name: "Siguiente" }).click({ timeout: 3_000 });
      await expect(error).toBeVisible({ timeout: 1_000 });
    }).toPass({ timeout: 30_000 });
    await expect(contenido.getByRole("heading", { level: 2, name: "1. Tipo" })).toBeVisible();

    // Las tarjetas son labels con un radio solo para lectores de pantalla: se toca la tarjeta.
    const mudanza = contenido.getByRole("radio", { name: /^Mudanza/ });
    await contenido.locator("label", { has: mudanza }).click();
    await expect(contenido.getByRole("heading", { level: 2, name: "2. Origen y destino" })).toBeVisible();
    await expect(error).toBeHidden();
  });
});

test.describe("como fletero", () => {
  test.use({ storageState: sesionDe("carlos") });

  test("entra a sus trabajos y al perfil de vehículo, zona y documentos", async ({ page }) => {
    await page.goto("/fletero/trabajos");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Mis trabajos");

    await page.goto("/fletero/perfil");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Vehículo, zona y documentos");
  });
});

test.describe("como admin", () => {
  test.use({ storageState: sesionDe("admin") });

  test("las pestañas de fleteros y reportes cambian con la URL", async ({ page }) => {
    await page.goto("/admin/fleteros");
    const fleteros = page.getByRole("navigation", { name: "Fleteros", exact: true });
    await fleteros.getByRole("link", { name: "Todas las cuentas" }).click();
    await expect(page).toHaveURL("/admin/fleteros?tab=cuentas");
    await expect(fleteros.getByRole("link", { name: "Todas las cuentas" })).toHaveAttribute(
      "aria-current",
      "page",
    );

    await page.goto("/admin/reportes");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Reportes");
    await expect(page.getByText("Denuncias abiertas")).toBeVisible();
    const reportes = page.getByRole("navigation", { name: "Reportes", exact: true });
    await expect(reportes.getByRole("link", { name: /^Denuncias/ })).toHaveAttribute("aria-current", "page");
    await reportes.getByRole("link", { name: "Pedidos" }).click();
    await expect(page).toHaveURL("/admin/reportes?tab=pedidos");
    await expect(reportes.getByRole("link", { name: "Pedidos" })).toHaveAttribute("aria-current", "page");
  });
});
