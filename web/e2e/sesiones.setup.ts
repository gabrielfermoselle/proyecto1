import { test as setup } from "@playwright/test";
import { CUENTAS, type Cuenta, ingresarComo, sesionDe } from "./utils";

// Inicia sesión una vez por cuenta y guarda las cookies: los demás tests arrancan ya logueados.
for (const cuenta of Object.keys(CUENTAS) as Cuenta[]) {
  setup(`sesión de ${cuenta}`, async ({ page }) => {
    await ingresarComo(page, cuenta);
    await page.context().storageState({ path: sesionDe(cuenta) });
  });
}
