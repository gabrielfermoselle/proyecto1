import { expect, test } from "@playwright/test";
import { CUENTAS, ingresar, sesionDe } from "./utils";

// Acceso: quién entra a dónde. El middleware es la primera barrera; las páginas y las Server
// Actions vuelven a verificar (eso lo cubre src/lib/autorizacion.db.test.ts).

test.describe("sin sesión", () => {
  test("la portada lleva al registro con el rol elegido", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Tu flete en Tucumán");
    await page.getByRole("link", { name: "Soy fletero" }).click();
    await expect(page).toHaveURL(/\/registro\?rol=fletero/);
    await expect(page.getByRole("heading", { name: "Creá tu cuenta" })).toBeVisible();
  });

  for (const ruta of ["/cliente", "/fletero/solicitudes", "/admin"]) {
    test(`${ruta} pide iniciar sesión`, async ({ page }) => {
      await page.goto(ruta);
      await expect(page).toHaveURL(`/login?callbackUrl=${encodeURIComponent(ruta)}`);
    });
  }

  test("después del login vuelve a la página que se pidió", async ({ page }) => {
    await page.goto("/cliente/solicitudes");
    await page.getByLabel("Email").fill(CUENTAS.ana.email);
    await page.getByLabel("Contraseña").fill("Demo1234");
    await page.getByRole("button", { name: "Ingresar" }).click();
    await expect(page).toHaveURL("/cliente/solicitudes");
    await expect(page.getByRole("heading", { name: "Mis solicitudes" })).toBeVisible();
  });

  test("con la contraseña incorrecta muestra el error y no entra", async ({ page }) => {
    await ingresar(page, CUENTAS.ana.email, "incorrecta");
    await expect(page.getByText("El email o la contraseña no son correctos.")).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe("cada rol entra a su área", () => {
  const casos = [
    { cuenta: "ana", saludo: "Hola, Ana", ajenas: ["/fletero", "/admin"] },
    { cuenta: "carlos", saludo: "Hola, Carlos", ajenas: ["/cliente", "/admin"] },
    { cuenta: "admin", saludo: "Administración", ajenas: ["/cliente", "/fletero"] },
  ] as const;

  for (const { cuenta, saludo, ajenas } of casos) {
    test.describe(cuenta, () => {
      test.use({ storageState: sesionDe(cuenta) });

      test(`/panel lo lleva a ${CUENTAS[cuenta].area}`, async ({ page }) => {
        await page.goto("/panel");
        await expect(page).toHaveURL(CUENTAS[cuenta].area);
        await expect(page.getByRole("heading", { level: 1 })).toHaveText(saludo);
      });

      for (const ajena of ajenas) {
        test(`${ajena} lo devuelve a su área`, async ({ page }) => {
          await page.goto(ajena);
          await expect(page).toHaveURL(CUENTAS[cuenta].area);
        });
      }
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
    await page.goto("/fletero/agenda");
    await expect(page.getByRole("heading", { level: 2, name: /^Semana del / })).toHaveText(
      /^Semana del lun,? \d{1,2} [a-z]{3}$/,
    );
  });
});
