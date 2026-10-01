import { describe, expect, it } from "vitest";
import { diaDesdeIso, fechaIsoAr, finDelDiaAr, inicioDeSemana, mesAr, sumarDias } from "./fechas";

describe("fechas en Tucumán (UTC−3)", () => {
  it("a la 1 de la mañana UTC todavía es el día anterior en Tucumán", () => {
    expect(fechaIsoAr(new Date("2026-10-02T01:00:00Z"))).toBe("2026-10-01");
    expect(fechaIsoAr(new Date("2026-10-02T03:00:00Z"))).toBe("2026-10-02");
  });

  it("el fin del día es 23:59:59.999 hora local", () => {
    expect(finDelDiaAr("2026-10-01").toISOString()).toBe("2026-10-02T02:59:59.999Z");
  });

  it("suma días cruzando meses", () => {
    expect(sumarDias("2026-10-30", 3)).toBe("2026-11-02");
    expect(sumarDias("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("el inicio de semana es el lunes", () => {
    expect(inicioDeSemana("2026-10-01")).toBe("2026-09-28"); // jueves → lunes
    expect(inicioDeSemana("2026-10-04")).toBe("2026-09-28"); // domingo → lunes anterior
    expect(inicioDeSemana("2026-09-28")).toBe("2026-09-28");
  });

  it("agrupa por mes en hora local", () => {
    expect(mesAr(new Date("2026-11-01T02:00:00Z"))).toBe("2026-10");
  });

  it("rechaza fechas inválidas", () => {
    expect(() => diaDesdeIso("2026-13-45")).toThrow(RangeError);
  });
});
