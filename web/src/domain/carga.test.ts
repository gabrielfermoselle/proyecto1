import { describe, expect, it } from "vitest";
import { FACTOR_ESTIBA, resumirCarga } from "./carga";

describe("resumirCarga", () => {
  it("devuelve ceros sin ítems", () => {
    expect(resumirCarga([])).toEqual({
      pesoTotalKg: 0,
      volumenTotalM3: 0,
      itemsSinMedidas: 0,
      cantidadBultos: 0,
    });
  });

  it("multiplica volumen y peso por la cantidad y aplica la estiba al volumen", () => {
    // 4 cajas de 50×40×40 cm (0,08 m³ c/u) y 12 kg c/u.
    const r = resumirCarga([{ cantidad: 4, largoCm: 50, anchoCm: 40, altoCm: 40, pesoKgAprox: 12 }]);
    expect(r.volumenTotalM3).toBeCloseTo(0.32 * FACTOR_ESTIBA, 3);
    expect(r.pesoTotalKg).toBe(48);
    expect(r.cantidadBultos).toBe(4);
    expect(r.itemsSinMedidas).toBe(0);
  });

  it("cuenta como incompleto un ítem al que le falta alguna medida o el peso, sin sumar lo que falta", () => {
    const r = resumirCarga([
      { cantidad: 1, largoCm: 180, anchoCm: 70, altoCm: 60, pesoKgAprox: 65 }, // heladera completa
      { cantidad: 2, largoCm: 60, anchoCm: 60, altoCm: null, pesoKgAprox: 8 }, // sin alto
      { cantidad: 3, pesoKgAprox: null }, // sin nada
    ]);
    expect(r.itemsSinMedidas).toBe(2);
    expect(r.pesoTotalKg).toBe(81);
    expect(r.volumenTotalM3).toBeCloseTo(0.756 * FACTOR_ESTIBA, 3);
    expect(r.cantidadBultos).toBe(6);
  });

  it("trata medidas en cero como faltantes", () => {
    expect(
      resumirCarga([{ cantidad: 1, largoCm: 0, anchoCm: 10, altoCm: 10, pesoKgAprox: 1 }]).itemsSinMedidas,
    ).toBe(1);
  });

  it("rechaza cantidades no enteras o no positivas", () => {
    expect(() => resumirCarga([{ cantidad: 0 }])).toThrow(RangeError);
    expect(() => resumirCarga([{ cantidad: 1.5 }])).toThrow(RangeError);
  });
});
