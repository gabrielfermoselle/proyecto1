import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { type Cuenta, sesionDe } from "./utils";

// axe con las reglas de WCAG 2.1 A y AA sobre las pantallas principales de cada rol. Falla con
// cualquier violación grave o crítica; las moderadas y menores se adjuntan al reporte.

type Pantalla = { nombre: string; ruta: string; abrir?: (page: Page) => Promise<void> };

/** Abre el primer enlace que coincida: los IDs de las pantallas de detalle cambian con cada seed. */
const primerEnlace = (nombre: RegExp) => async (page: Page) => {
  const antes = page.url();
  await page.getByRole("main").getByRole("link", { name: nombre }).first().click();
  await page.waitForURL((url) => url.href !== antes);
};

/** Primera solicitud del feed del fletero (los títulos de las tarjetas son h2 con enlace). */
const primeraSolicitud = async (page: Page) => {
  const antes = page.url();
  await page.getByRole("main").getByRole("heading", { level: 2 }).getByRole("link").first().click();
  await page.waitForURL((url) => url.href !== antes);
};

const PANTALLAS: Record<Cuenta | "anonimo", Pantalla[]> = {
  anonimo: [
    { nombre: "portada", ruta: "/" },
    { nombre: "login", ruta: "/login" },
    { nombre: "registro", ruta: "/registro" },
  ],
  ana: [
    { nombre: "mis fletes", ruta: "/cliente" },
    { nombre: "mis solicitudes", ruta: "/cliente/solicitudes" },
    {
      nombre: "comparar presupuestos",
      ruta: "/cliente/solicitudes",
      abrir: primerEnlace(/Mudanza de monoambiente/),
    },
    { nombre: "publicar solicitud", ruta: "/cliente/solicitudes/nueva" },
    { nombre: "buscar fleteros", ruta: "/cliente/fleteros" },
    { nombre: "perfil del cliente", ruta: "/cliente/perfil" },
    { nombre: "perfil público de un fletero", ruta: "/cliente/fleteros", abrir: primerEnlace(/Carlos R\./) },
    { nombre: "chat", ruta: "/cliente/mensajes", abrir: primerEnlace(/Carlos R\./) },
    { nombre: "seguimiento del flete", ruta: "/cliente", abrir: primerEnlace(/Compra del mayorista/) },
  ],
  carlos: [
    { nombre: "inicio del fletero", ruta: "/fletero" },
    { nombre: "solicitudes cercanas", ruta: "/fletero/solicitudes" },
    { nombre: "solicitudes en el mapa", ruta: "/fletero/solicitudes?vista=mapa" },
    { nombre: "presupuestar", ruta: "/fletero/solicitudes", abrir: primeraSolicitud },
    { nombre: "mis presupuestos", ruta: "/fletero/presupuestos" },
    { nombre: "agenda", ruta: "/fletero/agenda" },
    { nombre: "perfil", ruta: "/fletero/perfil" },
  ],
  valeria: [
    { nombre: "revisar lo recibido", ruta: "/cliente", abrir: primerEnlace(/Escritorio y biblioteca/) },
  ],
  admin: [
    { nombre: "panel de administración", ruta: "/admin" },
    { nombre: "usuarios", ruta: "/admin/usuarios" },
    { nombre: "solicitudes", ruta: "/admin/solicitudes" },
    { nombre: "reclamos", ruta: "/admin/reclamos" },
  ],
  soledad: [{ nombre: "agenda con fletes", ruta: "/fletero/agenda" }],
  florencia: [],
  lucia: [],
};

for (const [cuenta, pantallas] of Object.entries(PANTALLAS)) {
  if (pantallas.length === 0) continue;

  test.describe(cuenta === "anonimo" ? "sin sesión" : `como ${cuenta}`, () => {
    if (cuenta !== "anonimo") test.use({ storageState: sesionDe(cuenta as Cuenta) });

    for (const { nombre, ruta, abrir } of pantallas) {
      test(`${nombre} no tiene violaciones graves`, async ({ page }, info) => {
        await page.goto(ruta);
        if (abrir) await abrir(page);
        // Los mapas y el chat se montan en el cliente. El chat consulta cada pocos segundos, así
        // que "networkidle" puede no llegar nunca: se espera un rato y se sigue.
        await page.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => undefined);

        const { violations } = await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
          .analyze();

        await info.attach("axe", {
          body: JSON.stringify(violations, null, 2),
          contentType: "application/json",
        });
        const graves = violations
          .filter((v) => v.impact === "serious" || v.impact === "critical")
          .map((v) => ({
            regla: v.id,
            impacto: v.impact,
            ayuda: v.help,
            nodos: v.nodes.slice(0, 5).map((n) => ({
              selector: n.target.join(" "),
              html: n.html.slice(0, 160),
              motivo: n.failureSummary?.split("\n").slice(1).join(" ").trim(),
            })),
          }));
        expect(graves, `Violaciones en ${page.url()}`).toEqual([]);
      });
    }
  });
}
