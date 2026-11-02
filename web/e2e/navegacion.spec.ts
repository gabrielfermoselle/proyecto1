import { expect, test } from "@playwright/test";
import { CUENTAS, ingresar, sesionDe } from "./utils";

// Acceso: quién entra a dónde. El middleware es la primera barrera; las páginas y las Server
// Actions vuelven a verificar (eso lo cubre src/lib/autorizacion.db.test.ts).

test.describe("sin sesión", () => {
  test("la portada lleva al registro con el rol elegido", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("¿Qué necesitás mover?");
    await page.getByRole("link", { name: "Soy fletero" }).click();
    await expect(page).toHaveURL(/\/registro\?rol=fletero/);
    await expect(page.getByRole("heading", { name: "Creá tu cuenta" })).toBeVisible();
  });

  for (const ruta of ["/cliente", "/fletero/trabajos", "/admin", "/chat", "/perfil"]) {
    test(`${ruta} pide iniciar sesión`, async ({ page }) => {
      await page.goto(ruta);
      await expect(page).toHaveURL(`/login?callbackUrl=${encodeURIComponent(ruta)}`);
    });
  }

  test("después del login vuelve a la página que se pidió", async ({ page }) => {
    await page.goto("/cliente/nuevo");
    await page.getByLabel("Email").fill(CUENTAS.ana.email);
    await page.getByLabel("Contraseña").fill("Demo1234");
    await page.getByRole("button", { name: "Ingresar" }).click();
    await expect(page).toHaveURL("/cliente/nuevo");
    await expect(page.getByRole("heading", { name: "¿Qué necesitás mover?" })).toBeVisible();
  });

  test("con la contraseña incorrecta muestra el error y no entra", async ({ page }) => {
    await ingresar(page, CUENTAS.ana.email, "incorrecta");
    await expect(page.getByText("El email o la contraseña no son correctos.")).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe("cada rol entra a su área", () => {
  const casos = [
    { cuenta: "ana", inicio: "/cliente", titulo: "Mis pedidos", ajenas: ["/fletero", "/admin"] },
    { cuenta: "carlos", inicio: "/fletero", titulo: "Pedidos disponibles", ajenas: ["/cliente", "/admin"] },
    {
      cuenta: "admin",
      inicio: "/admin/fleteros",
      titulo: "Fleteros",
      ajenas: ["/cliente", "/fletero", "/chat"],
    },
  ] as const;

  for (const { cuenta, inicio, titulo, ajenas } of casos) {
    test.describe(cuenta, () => {
      test.use({ storageState: sesionDe(cuenta) });

      test(`/panel lo lleva a ${inicio}`, async ({ page }) => {
        await page.goto("/panel");
        await expect(page).toHaveURL(inicio);
        await expect(page.getByRole("heading", { level: 1 })).toHaveText(titulo);
      });

      for (const ajena of ajenas) {
        test(`${ajena} lo devuelve a su área`, async ({ page }) => {
          await page.goto(ajena);
          await expect(page).toHaveURL(inicio);
        });
      }

      test("Mi cuenta es común a todos los roles", async ({ page }) => {
        await page.goto("/perfil");
        await expect(page.getByRole("heading", { level: 1 })).toHaveText("Mi cuenta");
      });
    });
  }
});

test("un fletero con el perfil incompleto va directo al onboarding", async ({ page }) => {
  await ingresar(page, "diego@demo.test");
  await expect(page).toHaveURL("/fletero/onboarding/datos");
  await expect(page.getByRole("heading", { name: "Configurá tu perfil de fletero" })).toBeVisible();
});

test("cerrar sesión vuelve a pedir el login", async ({ page }) => {
  await ingresar(page, CUENTAS.valeria.email);
  await expect(page).toHaveURL("/cliente");
  await page.getByRole("button", { name: "Salir" }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/cliente"));
  await page.goto("/cliente");
  await expect(page).toHaveURL(/\/login/);
});

test.describe("agenda del fletero", () => {
  test.use({ storageState: sesionDe("soledad") });

  test("la semana se titula con la fecha del lunes, nunca con «Ayer», «Hoy» o «Mañana»", async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, "La grilla semanal es solo de escritorio; en el teléfono la agenda va por día.");
    await page.goto("/fletero/trabajos");
    await expect(page.getByRole("heading", { level: 3, name: /^Semana del / })).toHaveText(
      /^Semana del lun,? \d{1,2} [a-z]{3}$/,
    );
  });
});

test.describe("las rutas anteriores siguen funcionando", () => {
  test.use({ storageState: sesionDe("ana") });

  for (const [vieja, nueva] of [
    ["/cliente/solicitudes", "/cliente"],
    ["/cliente/solicitudes/nueva", "/cliente/nuevo"],
    ["/cliente/mensajes", "/chat"],
    ["/cliente/perfil", "/perfil"],
  ] as const) {
    test(`${vieja} lleva a ${nueva}`, async ({ page }) => {
      await page.goto(vieja);
      await expect(page).toHaveURL(nueva);
    });
  }
});

test.describe("chat", () => {
  test.use({ storageState: sesionDe("ana") });

  test("la bandeja se pide al abrir el chat, no en bucle", async ({ page }) => {
    let pedidos = 0;
    page.on("request", (r) => {
      if (r.url().includes("/api/chat/bandeja")) pedidos++;
    });
    await page.goto("/chat");
    await expect(page.getByRole("list", { name: "Conversaciones" })).toBeVisible();
    await page.waitForTimeout(6_000);
    // Una al montar la lista y, como mucho, otra al conectarse el chat en vivo.
    expect(pedidos).toBeLessThanOrEqual(2);
  });
});
