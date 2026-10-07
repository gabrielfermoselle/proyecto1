import { expect, test } from "@playwright/test";

// Cada request lleva un id (x-request-id) que el servidor pone en sus logs JSON y devuelve en la
// respuesta: con ese id se encuentra en Vercel todo lo que pasó en ese request.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

test("las páginas y la API responden con un x-request-id nuevo en cada request", async ({ request }) => {
  const pagina = await request.get("/login");
  const api = await request.get("/api/notificaciones");
  const idPagina = pagina.headers()["x-request-id"];
  expect(idPagina).toMatch(UUID);
  expect(api.headers()["x-request-id"]).toMatch(UUID);
  expect(api.headers()["x-request-id"]).not.toBe(idPagina);
});

test("respeta un id válido que viene de un proxy y reemplaza uno que podría ensuciar los logs", async ({ request }) => {
  const valido = await request.get("/login", { headers: { "x-request-id": "proxy-abc-12345" } });
  expect(valido.headers()["x-request-id"]).toBe("proxy-abc-12345");

  const sucio = await request.get("/login", { headers: { "x-request-id": 'x" , "nivel": "falso' } });
  expect(sucio.headers()["x-request-id"]).toMatch(UUID);
});

test("las áreas privadas siguen pidiendo sesión", async ({ request }) => {
  const r = await request.get("/admin", { maxRedirects: 0 });
  expect(r.status()).toBe(307);
  expect(r.headers()["location"]).toContain("/login");
});
