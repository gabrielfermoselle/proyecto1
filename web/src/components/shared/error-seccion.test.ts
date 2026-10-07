import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ErrorSeccionVista } from "./error-seccion";

describe("pantalla de error de un área", () => {
  it("explica qué pasó, ofrece reintentar o ir al inicio y es un alert", () => {
    const html = renderToStaticMarkup(createElement(ErrorSeccionVista, { codigo: undefined, inicioHref: "/cliente" }));
    expect(html).toContain('role="alert"');
    expect(html).toContain("No pudimos cargar esta sección");
    expect(html).toContain("Reintentar");
    expect(html).toContain('href="/cliente"');
    expect(html).not.toContain("mencioná este código");
  });

  it("muestra el código del error (digest) para buscarlo en los logs, nunca el mensaje", () => {
    const html = renderToStaticMarkup(createElement(ErrorSeccionVista, { codigo: "1234567890", inicioHref: "/admin" }));
    expect(html).toContain("1234567890");
  });

  it("mientras reintenta, el botón queda deshabilitado", () => {
    const html = renderToStaticMarkup(
      createElement(ErrorSeccionVista, { codigo: undefined, inicioHref: "/fletero", reintentando: true }),
    );
    expect(html).toContain("Reintentando…");
    expect(html).toMatch(/<button[^>]*disabled/);
  });

  it.each([
    ["cliente", "src/app/cliente/error.tsx", "/cliente"],
    ["fletero", "src/app/fletero/(app)/error.tsx", "/fletero"],
    ["admin", "src/app/admin/error.tsx", "/admin"],
  ])("el área %s tiene su error.tsx, que vuelve a su inicio", (_area, archivo, inicio) => {
    const ruta = join(process.cwd(), archivo);
    expect(existsSync(ruta)).toBe(true);
    const fuente = readFileSync(ruta, "utf8");
    expect(fuente).toContain('"use client"');
    expect(fuente).toContain(`inicioHref="${inicio}"`);
  });
});
