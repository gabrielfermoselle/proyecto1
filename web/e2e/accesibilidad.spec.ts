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

/** Perfil público del primer fletero que presupuestó la mudanza de Ana. */
const abrirPerfilDesdePresupuesto = async (page: Page) => {
  await primerEnlace(/Mudanza de monoambiente/)(page);
  await primerEnlace(/Carlos R\./)(page);
};

const PANTALLAS: Record<Cuenta | "anonimo", Pantalla[]> = {
  anonimo: [
    { nombre: "portada", ruta: "/" },
    { nombre: "login", ruta: "/login" },
    { nombre: "registro", ruta: "/registro" },
    // [FUERA-S3] [BE] Cambiar y recuperar contraseña
    // { nombre: "recuperar contraseña", ruta: "/recuperar" },
  ],
  ana: [
    { nombre: "mis pedidos", ruta: "/cliente" },
    { nombre: "comparar presupuestos", ruta: "/cliente", abrir: primerEnlace(/Mudanza de monoambiente/) },
    { nombre: "nuevo pedido", ruta: "/cliente/nuevo" },
    // [FUERA-S3] [FE] Buscador de fleteros
    // { nombre: "buscar fleteros", ruta: "/cliente/fleteros" },
    // [FUERA-S3] [FE] Perfil del cliente
    // { nombre: "mi cuenta", ruta: "/perfil" },
    { nombre: "notificaciones", ruta: "/notificaciones" },
    // [FUERA-S3] [FE] Buscador de fleteros: el perfil público se abre desde un presupuesto recibido.
    // { nombre: "perfil público de un fletero", ruta: "/cliente/fleteros", abrir: primerEnlace(/Carlos R\./) },
    { nombre: "perfil público de un fletero", ruta: "/cliente", abrir: abrirPerfilDesdePresupuesto },
    // [FUERA-S3] [FE] Pantalla del chat
    // { nombre: "chat", ruta: "/chat", abrir: primerEnlace(/Carlos R\./) },
    { nombre: "seguimiento del flete", ruta: "/cliente", abrir: primerEnlace(/Compra del mayorista/) },
  ],
  carlos: [
    { nombre: "pedidos disponibles", ruta: "/fletero" },
    { nombre: "pedidos en el mapa", ruta: "/fletero?vista=mapa" },
    { nombre: "presupuestar", ruta: "/fletero", abrir: primeraSolicitud },
    { nombre: "mis presupuestos", ruta: "/fletero/trabajos?tab=presupuestos" },
    // [FUERA-S3] Ganancias del fletero
    // { nombre: "ganancias", ruta: "/fletero/trabajos?tab=ganancias" },
    // [FUERA-S3] [BE] Verificación de documentos
    // { nombre: "vehículo, zona y documentos", ruta: "/fletero/perfil" },
    { nombre: "vehículo, zona y tarifas", ruta: "/fletero/perfil" },
  ],
  // [FUERA-S3] [BE] Reclamos, firmas y calificación: valeria tenía un flete entregado para revisar.
  valeria: [],
  // valeria: [
  //   { nombre: "revisar lo recibido", ruta: "/cliente", abrir: primerEnlace(/Escritorio y biblioteca/) },
  // ],
  // [FUERA-S3] [FE] Panel de administración
  // admin: [
  //   { nombre: "verificar fleteros", ruta: "/admin/fleteros" },
  //   { nombre: "cuentas", ruta: "/admin/fleteros?tab=cuentas" },
  //   { nombre: "denuncias", ruta: "/admin/reportes" },
  //   { nombre: "pedidos", ruta: "/admin/reportes?tab=pedidos" },
  // ],
  soledad: [{ nombre: "agenda con fletes", ruta: "/fletero/trabajos" }],
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
