import { describe, expect, it } from "vitest";
import { evaluarCompatibilidad, puedeLlevar, vehiculoSugerido } from "./compatibilidad";

const MOTO = { id: "moto", capacidadKg: 25, volumenM3: 0.08 };
const KANGOO = { id: "kangoo", capacidadKg: 600, volumenM3: 3 };
const CAMION = { id: "camion", capacidadKg: 5_000, volumenM3: 25 };

const carga = (pesoTotalKg: number, volumenTotalM3: number, itemsSinMedidas = 0) => ({
  pesoTotalKg,
  volumenTotalM3,
  itemsSinMedidas,
});

describe("evaluarCompatibilidad", () => {
  it("acepta la carga que coincide exactamente con la capacidad", () => {
    expect(evaluarCompatibilidad(carga(600, 3), KANGOO)).toBe("COMPATIBLE");
  });

  it("rechaza por peso antes que por volumen", () => {
    expect(evaluarCompatibilidad(carga(601, 50), KANGOO)).toBe("EXCEDE_PESO");
    expect(evaluarCompatibilidad(carga(100, 3.01), KANGOO)).toBe("EXCEDE_VOLUMEN");
  });

  it("una mudanza no entra en una moto", () => {
    expect(evaluarCompatibilidad(carga(500, 6), MOTO)).toBe("EXCEDE_PESO");
  });

  it("marca SIN_DATOS cuando lo informado entra pero faltan medidas", () => {
    expect(evaluarCompatibilidad(carga(10, 0.01, 2), MOTO)).toBe("SIN_DATOS");
    expect(puedeLlevar("SIN_DATOS")).toBe(true);
    expect(puedeLlevar("EXCEDE_VOLUMEN")).toBe(false);
  });
});

describe("vehiculoSugerido", () => {
  const flota = [CAMION, MOTO, KANGOO];

  it("con datos completos elige el más chico que alcanza", () => {
    expect(vehiculoSugerido(carga(5, 0.05), flota)?.id).toBe("moto");
    expect(vehiculoSugerido(carga(300, 2), flota)?.id).toBe("kangoo");
  });

  it("si faltan medidas elige el más grande de los que pueden", () => {
    expect(vehiculoSugerido(carga(5, 0.05, 1), flota)?.id).toBe("camion");
  });

  it("devuelve null si ninguno alcanza", () => {
    expect(vehiculoSugerido(carga(9_000, 10), flota)).toBeNull();
    expect(vehiculoSugerido(carga(1, 0.01), [])).toBeNull();
  });
});
