import { describe, expect, it } from "vitest";
import { FACTOR_RUTA_URBANA } from "./geo";
import { precioSugerido, type Tarifas } from "./precio";

const CAMIONETA: Tarifas = {
  precioMinimo: 25_000,
  precioPorKm: 1_800,
  precioPorM3: 4_000,
  precioPorAyudante: 15_000,
};

describe("precioSugerido", () => {
  it("aplica el mínimo en viajes cortos", () => {
    expect(precioSugerido({ distanciaLinealKm: 2, volumenM3: 0.5, ayudantes: 0 }, CAMIONETA)).toBe(25_000);
  });

  it("cobra km de ruta y volumen cuando superan el mínimo", () => {
    // 10 km lineales × 1,3 = 13 km de ruta × 1800 = 23 400; 2 m³ × 4000 = 8000 → 31 400
    expect(FACTOR_RUTA_URBANA).toBe(1.3);
    expect(precioSugerido({ distanciaLinealKm: 10, volumenM3: 2, ayudantes: 0 }, CAMIONETA)).toBe(31_400);
  });

  it("suma los ayudantes por fuera del mínimo", () => {
    expect(precioSugerido({ distanciaLinealKm: 1, volumenM3: 0, ayudantes: 2 }, CAMIONETA)).toBe(55_000);
  });

  it("redondea a $100", () => {
    const precio = precioSugerido({ distanciaLinealKm: 7.77, volumenM3: 1.234, ayudantes: 0 }, CAMIONETA);
    expect(precio % 100).toBe(0);
  });

  it("con tarifas en cero devuelve 0 (fletero que todavía no configuró precios)", () => {
    const sinTarifas: Tarifas = { precioMinimo: 0, precioPorKm: 0, precioPorM3: 0, precioPorAyudante: 0 };
    expect(precioSugerido({ distanciaLinealKm: 10, volumenM3: 3, ayudantes: 1 }, sinTarifas)).toBe(0);
  });

  it("rechaza valores negativos o ayudantes no enteros", () => {
    expect(() => precioSugerido({ distanciaLinealKm: -1, volumenM3: 0, ayudantes: 0 }, CAMIONETA)).toThrow(
      RangeError,
    );
    expect(() => precioSugerido({ distanciaLinealKm: 1, volumenM3: 0, ayudantes: 1.5 }, CAMIONETA)).toThrow(
      RangeError,
    );
    expect(() =>
      precioSugerido({ distanciaLinealKm: 1, volumenM3: 0, ayudantes: 0 }, { ...CAMIONETA, precioPorKm: -5 }),
    ).toThrow(RangeError);
  });
});
