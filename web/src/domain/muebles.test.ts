import { describe, expect, it } from "vitest";
import { resumirCarga } from "./carga";
import { buscarMueble, MUEBLES_ESTANDAR, sugerirMuebles } from "./muebles";

describe("MUEBLES_ESTANDAR", () => {
  it("cada mueble tiene medidas y peso dentro de lo que acepta el formulario", () => {
    for (const m of MUEBLES_ESTANDAR) {
      for (const cm of [m.largoCm, m.anchoCm, m.altoCm]) {
        expect(Number.isInteger(cm) && cm >= 1 && cm <= 1000, m.nombre).toBe(true);
      }
      expect(m.pesoKgAprox >= 0.1 && m.pesoKgAprox <= 5000, m.nombre).toBe(true);
      expect(resumirCarga([{ cantidad: 1, ...m }]).itemsSinMedidas, m.nombre).toBe(0);
    }
  });

  it("cada mueble tiene su propia foto con un nombre de archivo simple", () => {
    for (const m of MUEBLES_ESTANDAR) expect(m.foto, m.nombre).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*\.webp$/);
    expect(new Set(MUEBLES_ESTANDAR.map((m) => m.foto)).size).toBe(MUEBLES_ESTANDAR.length);
    expect(buscarMueble("Colchón king")?.foto).toBe("colchon-king.webp");
  });

  it("no repite nombres", () => {
    const nombres = MUEBLES_ESTANDAR.map((m) => m.nombre.toLowerCase());
    expect(new Set(nombres).size).toBe(nombres.length);
  });
});

describe("buscarMueble", () => {
  it("encuentra el mueble sin importar mayúsculas, acentos ni espacios", () => {
    expect(buscarMueble("Heladera simple")?.altoCm).toBe(145);
    expect(buscarMueble("  heladera   DOBLE ")?.altoCm).toBe(180);
    expect(buscarMueble("sillon de 3 cuerpos")?.nombre).toBe("Sillón de 3 cuerpos");
  });

  it("devuelve null si no es un nombre completo de la lista", () => {
    expect(buscarMueble("Heladera")).toBeNull();
    expect(buscarMueble("Piano")).toBeNull();
    expect(buscarMueble("")).toBeNull();
  });
});

describe("sugerirMuebles", () => {
  const nombres = (texto: string) => sugerirMuebles(texto).map((m) => m.nombre);

  it("no sugiere nada hasta que se escribe algo", () => {
    expect(nombres("")).toEqual([]);
    expect(nombres("   ")).toEqual([]);
  });

  it("sugiere solo los que contienen lo escrito, sin importar acentos", () => {
    expect(nombres("helad")).toEqual(["Heladera simple", "Heladera doble", "Heladera side by side"]);
    expect(nombres("colchon k")).toEqual(["Colchón king"]);
    expect(nombres("trampolín")).toEqual([]);
  });

  it("busca también por tipo y por ambiente, en singular o plural", () => {
    const muebles = sugerirMuebles("muebles");
    expect(muebles.length).toBeGreaterThan(30);
    expect(muebles.every((m) => m.tipo === "Mueble")).toBe(true);
    expect(sugerirMuebles("electrodomésticos").every((m) => m.tipo === "Electrodoméstico")).toBe(true);
    expect(nombres("dormitorio")).toContain("Placard de 2 puertas");
  });

  it("pone primero lo que coincide por nombre", () => {
    expect(nombres("cocina").slice(0, 2)).toEqual(["Cocina", "Mesa de cocina"]);
    expect(nombres("cocina")).toContain("Heladera simple");
  });

  it("con el nombre completo sugiere solo ese", () => {
    expect(nombres("Heladera doble")).toEqual(["Heladera doble"]);
  });
});
