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

  it("cada mueble con foto tiene la suya, con un nombre de archivo simple", () => {
    const fotos = MUEBLES_ESTANDAR.flatMap((m) => (m.foto ? [m.foto] : []));
    for (const foto of fotos) expect(foto).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*\.webp$/);
    expect(new Set(fotos).size).toBe(fotos.length);
    expect(buscarMueble("Colchón king")?.foto).toBe("colchon-king.webp");
    expect(buscarMueble("Paquete mediano")?.foto).toBeNull();
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

  it("con un tipo de flete sugiere solo los productos de ese tipo", () => {
    const de = (texto: string, tipo: Parameters<typeof sugerirMuebles>[1]) =>
      sugerirMuebles(texto, tipo).map((m) => m.nombre);
    expect(de("bolsa", "COMPRAS")).toContain("Bolsa de cemento (50 kg)");
    expect(de("helad", "COMPRAS")).toEqual([]);
    expect(de("caja", "PAQUETERIA")).toContain("Caja de mudanza");
    expect(de("paquete", "MUDANZA")).toEqual([]);
    expect(de("caja", "MUEBLES")).not.toContain("Caja de mudanza");
    expect(de("cemento", "OTRO")).toEqual(["Bolsa de cemento (50 kg)"]);
  });
});
