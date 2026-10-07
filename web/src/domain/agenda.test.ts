import { describe, expect, it } from "vitest";
import { agruparPorDia, conflictosCon, franjasSeSuperponen, hayConflicto, idsEnConflicto } from "./agenda";

describe("franjasSeSuperponen", () => {
  it("franjas distintas no chocan, aunque sean contiguas", () => {
    expect(franjasSeSuperponen("MANANA", "MEDIODIA")).toBe(false);
    expect(franjasSeSuperponen("MANANA", "TARDE")).toBe(false);
  });

  it("la misma franja choca", () => {
    expect(franjasSeSuperponen("TARDE", "TARDE")).toBe(true);
  });

  it("FLEXIBLE choca con cualquier franja", () => {
    expect(franjasSeSuperponen("FLEXIBLE", "MANANA")).toBe(true);
    expect(franjasSeSuperponen("TARDE", "FLEXIBLE")).toBe(true);
  });
});

describe("hayConflicto", () => {
  it("días distintos nunca chocan", () => {
    expect(
      hayConflicto({ fecha: "2026-10-01", franja: "FLEXIBLE" }, { fecha: "2026-10-02", franja: "FLEXIBLE" }),
    ).toBe(false);
  });
});

describe("idsEnConflicto", () => {
  it("marca a todos los que chocan con al menos otro", () => {
    const ids = idsEnConflicto([
      { id: "a", fecha: "2026-10-01", franja: "MANANA" },
      { id: "b", fecha: "2026-10-01", franja: "FLEXIBLE" },
      { id: "c", fecha: "2026-10-01", franja: "TARDE" },
      { id: "d", fecha: "2026-10-02", franja: "MANANA" },
    ]);
    expect([...ids].sort()).toEqual(["a", "b", "c"]);
  });

  it("sin choques devuelve vacío", () => {
    expect(idsEnConflicto([{ id: "a", fecha: "2026-10-01", franja: "MANANA" }]).size).toBe(0);
  });
});

describe("conflictosCon", () => {
  it("devuelve los turnos que chocan con uno nuevo", () => {
    const agenda = [
      { id: "x", fecha: "2026-10-01", franja: "MANANA" as const },
      { id: "y", fecha: "2026-10-01", franja: "TARDE" as const },
    ];
    expect(conflictosCon({ fecha: "2026-10-01", franja: "MANANA" }, agenda).map((t) => t.id)).toEqual(["x"]);
  });
});

describe("agruparPorDia", () => {
  it("ordena por día y por franja", () => {
    const grupos = agruparPorDia([
      { id: "3", fecha: "2026-10-02", franja: "MANANA" as const },
      { id: "2", fecha: "2026-10-01", franja: "TARDE" as const },
      { id: "1", fecha: "2026-10-01", franja: "MANANA" as const },
    ]);
    expect(grupos.map((g) => [g.fecha, g.turnos.map((t) => t.id)])).toEqual([
      ["2026-10-01", ["1", "2"]],
      ["2026-10-02", ["3"]],
    ]);
  });
});
