import { describe, expect, it } from "vitest";
import { calcularValidoHasta, esPrecioMuyBajo, estaVencido, horaEnFranja } from "./presupuesto";

const AHORA = new Date("2026-10-01T15:00:00Z"); // 12 h en Tucumán

describe("calcularValidoHasta", () => {
  it("suma el plazo elegido cuando el flete es más adelante", () => {
    expect(calcularValidoHasta("48h", "2026-10-10", AHORA).toISOString()).toBe("2026-10-03T15:00:00.000Z");
  });

  it("nunca vence después del día del flete", () => {
    // Flete mañana: 7 días se recortan al fin de mañana (23:59 de Tucumán).
    expect(calcularValidoHasta("7d", "2026-10-02", AHORA).toISOString()).toBe("2026-10-03T02:59:59.999Z");
    // Flete hoy: vence esta noche.
    expect(calcularValidoHasta("24h", "2026-10-01", AHORA).toISOString()).toBe("2026-10-02T02:59:59.999Z");
  });
});

describe("esPrecioMuyBajo", () => {
  it("avisa por debajo del 60 % del sugerido", () => {
    expect(esPrecioMuyBajo(5_000, 50_000)).toBe(true);
    expect(esPrecioMuyBajo(30_000, 50_000)).toBe(false);
  });

  it("sin sugerido no avisa", () => {
    expect(esPrecioMuyBajo(1_000, 0)).toBe(false);
  });
});

describe("estaVencido", () => {
  it("compara con el instante actual", () => {
    expect(estaVencido(new Date("2026-10-01T14:59:59Z"), AHORA)).toBe(true);
    expect(estaVencido(new Date("2026-10-01T15:00:01Z"), AHORA)).toBe(false);
  });
});

describe("horaEnFranja", () => {
  const manana = { desde: 8, hasta: 12 };
  it("acepta horas dentro de la franja, bordes incluidos", () => {
    expect(horaEnFranja("08:00", manana)).toBe(true);
    expect(horaEnFranja("10:45", manana)).toBe(true);
    expect(horaEnFranja("12:00", manana)).toBe(true);
  });
  it("rechaza horas fuera de la franja o mal escritas", () => {
    expect(horaEnFranja("07:59", manana)).toBe(false);
    expect(horaEnFranja("12:01", manana)).toBe(false);
    expect(horaEnFranja("9:30", manana)).toBe(false);
  });
});
