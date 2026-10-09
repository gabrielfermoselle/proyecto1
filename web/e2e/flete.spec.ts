import { expect, test, type Browser, type Page } from "@playwright/test";
import { type Cuenta, sesionDe } from "./utils";

// El recorrido central, con dos personas reales en dos navegadores: Florencia (cliente) publicó
// "Bicicleta y caja de herramientas" en el seed y Carlos (fletero) la tiene a 0 m de su base.
// Los pasos dependen unos de otros: corren en orden y, si uno falla, se saltean los demás.
test.describe.configure({ mode: "serial" });

const SOLICITUD = "Bicicleta y caja de herramientas";

async function como(browser: Browser, cuenta: Cuenta): Promise<Page> {
  const contexto = await browser.newContext({ storageState: sesionDe(cuenta) });
  return contexto.newPage();
}

let florencia: Page;
let carlos: Page;

test.beforeAll(async ({ browser }) => {
  florencia = await como(browser, "florencia");
  carlos = await como(browser, "carlos");
});

test.afterAll(async () => {
  await florencia.context().close();
  await carlos.context().close();
});

test("el fletero ve el pedido cerca suyo y presupuesta", async () => {
  await carlos.goto("/fletero");
  await carlos.getByRole("link", { name: SOLICITUD }).click();
  await expect(carlos.getByRole("heading", { level: 1 })).toHaveText(SOLICITUD);
  // La dirección exacta no se muestra hasta que acepten el presupuesto.
  await expect(
    carlos.getByText(/La dirección exacta y el teléfono aparecen si el cliente acepta tu presupuesto\./),
  ).toBeVisible();

  await carlos.getByLabel("Tu precio ($)").fill("23500");
  await carlos.getByLabel("Mensaje para el cliente (opcional)").fill("Llevo la bici parada y atada.");
  const enviar = carlos.getByRole("button", { name: "Enviar presupuesto de $ 23.500" });
  await enviar.click();
  await expect(enviar).toBeHidden();

  await carlos.goto("/fletero/trabajos?tab=presupuestos");
  await expect(carlos.getByRole("heading", { name: SOLICITUD })).toBeVisible();
});

test("la cliente recibe el presupuesto y lo consulta por chat", async () => {
  await florencia.goto("/cliente");
  await florencia.getByRole("link", { name: new RegExp(SOLICITUD) }).click();
  const presupuestos = florencia.getByRole("region", { name: "Presupuestos recibidos (1)" });
  await expect(presupuestos).toContainText("Carlos R.");
  await expect(presupuestos).toContainText("$ 23.500");
  await expect(presupuestos).toContainText("Llevo la bici parada y atada.");

  await presupuestos.getByRole("link", { name: "Chat", exact: true }).click();
  await florencia.getByRole("textbox", { name: "Mensaje" }).fill("¿Podés pasar después de las 17?");
  await florencia.getByRole("button", { name: "Enviar", exact: true }).click();
  await expect(florencia.getByRole("list", { name: "Mensajes" })).toContainText(
    "¿Podés pasar después de las 17?",
  );
});

test("el fletero lee el mensaje y responde; la cliente ve la respuesta", async () => {
  await carlos.goto("/chat");
  await carlos.getByRole("link", { name: new RegExp(`Florencia L\\..*${SOLICITUD}`) }).click();
  const mensajes = carlos.getByRole("list", { name: "Mensajes" });
  await expect(mensajes).toContainText("¿Podés pasar después de las 17?");

  // No se pueden pasar datos de contacto antes de confirmar el flete.
  await expect(carlos.getByText(/Los teléfonos y emails se ocultan/)).toBeVisible();

  await carlos.getByRole("textbox", { name: "Mensaje" }).fill("Sí, paso 17:30.");
  await carlos.getByRole("button", { name: "Enviar", exact: true }).click();
  await expect(mensajes).toContainText("Sí, paso 17:30.");

  // Sin Supabase el chat se actualiza por consultas periódicas: llega sin recargar.
  await expect(florencia.getByRole("list", { name: "Mensajes" })).toContainText("Sí, paso 17:30.", {
    timeout: 30_000,
  });
});

test("la cliente acepta y se crea el flete para los dos", async () => {
  await florencia.goto("/cliente");
  await florencia.getByRole("link", { name: new RegExp(SOLICITUD) }).click();
  await florencia
    .getByRole("region", { name: "Presupuestos recibidos (1)" })
    .getByRole("button", { name: /^Aceptar/ })
    .click();
  const dialogo = florencia.getByRole("dialog", { name: "¿Aceptar este presupuesto?" });
  await expect(dialogo).toContainText("Carlos R.");
  await expect(dialogo).toContainText("$ 23.500");
  await dialogo.getByRole("button", { name: "Aceptar y confirmar" }).click();
  await expect(dialogo).toBeHidden();

  // El pedido sigue en la misma página, ahora con el flete y el contacto directo.
  await expect(florencia).toHaveURL(/\/cliente\/pedido\//);
  await florencia.reload();
  await expect(florencia.locator("#contenido").getByText("Etapa 1 de 7: Confirmado")).toBeVisible();
  await expect(florencia.locator("#contenido").getByRole("link", { name: "WhatsApp" })).toBeVisible();

  await carlos.goto("/fletero/trabajos");
  await carlos.locator("#contenido").getByRole("link", { name: SOLICITUD }).click();
  await expect(carlos).toHaveURL(/\/fletero\/pedido\//);
  await expect(carlos.locator("#contenido").getByText("Etapa 1 de 7: Confirmado")).toBeVisible();
  // Con el flete confirmado, el fletero ya ve la dirección exacta.
  await expect(carlos.locator("#contenido").getByRole("link", { name: "Cómo llegar" }).first()).toBeVisible();
});

/**
 * Marca el inventario y recarga. El botón de la etapa lee el resumen del servidor: un refresco
 * que ya estaba en curso puede traer el dato viejo y dejarlo deshabilitado.
 */
async function marcar(page: Page, nombre: string) {
  const boton = page.locator("#contenido").getByRole("button", { name: nombre });
  const guardado = page.waitForRequest(
    (pedido) => pedido.method() === "POST" && pedido.headers()["next-action"] !== undefined,
  );
  await boton.click();
  await (await guardado).response();
  await page.reload();
}

/** Avanza de etapa con el botón principal y lo confirma en el diálogo (firmando, si lo pide). */
async function avanzar(page: Page, boton: string, etapa: string, { firma = false } = {}) {
  const contenido = page.locator("#contenido");
  const principal = contenido.getByRole("button", { name: boton, exact: true });
  await expect(principal).toBeEnabled({ timeout: 20_000 });
  await principal.click();
  const dialogo = page.getByRole("dialog", { name: boton });
  if (firma) {
    const confirmar = dialogo.getByRole("button", { name: "Firmar y confirmar" });
    await expect(confirmar).toBeDisabled();
    await dialogo.getByLabel("Firmo la conformidad").check();
    await confirmar.click();
  } else {
    await dialogo.getByRole("button", { name: "Sí, confirmar" }).click();
  }
  // La ubicación y el guardado pueden tardar; después se recarga para ver la etapa ya guardada.
  await expect(dialogo).toBeHidden({ timeout: 25_000 });
  await page.reload();
  await expect(contenido.getByText(etapa)).toBeVisible();
}

test("el fletero sale a buscar la carga y la cliente ve el avance", async () => {
  await avanzar(carlos, "Salgo a buscar la carga", "Etapa 2 de 7: En camino al origen");

  await florencia.reload();
  await expect(florencia.locator("#contenido").getByText("Etapa 2 de 7: En camino al origen")).toBeVisible();
});

test("el fletero no puede salir sin cargar todo; carga ítem por ítem y sale", async () => {
  await avanzar(carlos, "Llegué al origen", "Etapa 3 de 7: Cargando");
  const contenido = carlos.locator("#contenido");
  const salir = contenido.getByRole("button", { name: "Terminé de cargar, salgo" });
  await expect(salir).toBeDisabled();

  await marcar(carlos, "Cargado: Bicicleta rodado 29");
  await expect(salir).toBeDisabled();
  await marcar(carlos, "Cargado: Caja de herramientas");
  await expect(salir).toBeEnabled();
  // Con ítems cargados ya no se puede cancelar.
  await expect(contenido.getByRole("button", { name: "No puedo hacer este flete" })).toBeHidden();

  await avanzar(carlos, "Terminé de cargar, salgo", "Etapa 4 de 7: En traslado");
});

test("el fletero descarga todo y firma la entrega", async () => {
  await avanzar(carlos, "Llegué al destino", "Etapa 5 de 7: Descargando");
  await marcar(carlos, "Todo: entregado");
  await avanzar(carlos, "Terminé de descargar", "Etapa 6 de 7: Entregado", { firma: true });
});

test("la cliente revisa lo que recibió, cierra el flete y califica", async () => {
  await florencia.reload();
  const contenido = florencia.locator("#contenido");
  await expect(contenido.getByText("Etapa 6 de 7: Entregado")).toBeVisible();
  const cerrar = contenido.getByRole("button", { name: "Cerrar el flete" });
  await expect(cerrar).toBeDisabled();

  await marcar(florencia, "Todo: recibido");
  await avanzar(florencia, "Cerrar el flete", "Etapa 7 de 7: Cerrado", { firma: true });

  await contenido.getByRole("link", { name: /¿Cómo te fue con Carlos R\.\?/ }).click();
  await expect(florencia).toHaveURL(/\/calificar$/);
  // El radio es solo para lectores de pantalla: se toca la estrella (el label que lo envuelve).
  const cinco = contenido.getByRole("radio", { name: "5 estrellas: Excelente" });
  await contenido.locator("label", { hasText: "5 estrellas: Excelente" }).click();
  await expect(cinco).toBeChecked();
  await florencia.locator("#contenido").getByLabel(/Comentario/).fill("Puntual y cuidadoso con la bici.");
  const calificar = florencia.locator("#contenido").getByRole("button", { name: "Enviar calificación" });
  await calificar.click();
  await expect(florencia).toHaveURL(/\/cliente\/pedido\/[^/]+$/);
  await expect(florencia.locator("#contenido").getByRole("region", { name: "Tu calificación" })).toBeVisible();

  // El promedio público del fletero pasa de 4,5 (2) a 4,7 (3).
  await florencia.goto("/cliente/fleteros");
  await expect(
    florencia.locator("#contenido").getByRole("link", { name: /Carlos R\./ }).first(),
  ).toContainText("4,7 (3)");
});
