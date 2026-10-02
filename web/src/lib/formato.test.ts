import { describe, expect, it } from "vitest";
import { formatearFechaHora, formatearHora, nombrePublico } from "./formato";

describe("formato de horas", () => {
  // 21:05 UTC = 18:05 en Tucumán (UTC−3).
  const tarde = new Date("2026-10-02T21:05:00Z");

  it("usa el reloj de 24 h, en la hora de Tucumán", () => {
    expect(formatearHora(tarde)).toBe("18:05");
    expect(formatearFechaHora(tarde)).toMatch(/^2 oct\.?,? 18:05$/);
    expect(formatearHora(new Date("2026-10-02T03:30:00Z"))).toBe("00:30");
  });
});

describe("nombrePublico", () => {
  it("muestra el nombre y la inicial del apellido", () => {
    expect(nombrePublico("Ana", "Pereyra")).toBe("Ana P.");
    expect(nombrePublico("Ana", "")).toBe("Ana");
  });
});
