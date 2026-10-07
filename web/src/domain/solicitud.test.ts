import { describe, expect, it } from "vitest";
import {
  destacados,
  fechaPermitida,
  ordenarPresupuestos,
  ratingPonderado,
  trayectoValido,
  type PresupuestoComparable,
} from "./solicitud";

const p = (
  id: string,
  monto: number,
  rating: number | null,
  calificaciones: number,
  venceHora = 12,
): PresupuestoComparable => ({
  id,
  monto,
  rating,
  calificaciones,
  fletesCompletados: calificaciones,
  validoHasta: new Date(Date.UTC(2026, 9, 5, venceHora)),
});

describe("fechaPermitida", () => {
  it("desde hoy hasta 60 días", () => {
    expect(fechaPermitida("2026-10-02", "2026-10-02")).toBe(true);
    expect(fechaPermitida("2026-10-01", "2026-10-02")).toBe(false);
    expect(fechaPermitida("2026-12-01", "2026-10-02")).toBe(true);
    expect(fechaPermitida("2026-12-02", "2026-10-02")).toBe(false);
  });
});

describe("trayectoValido", () => {
  it("rechaza origen y destino en el mismo lugar", () => {
    expect(trayectoValido({ lat: -26.83, lng: -65.2 }, { lat: -26.8301, lng: -65.2001 })).toBe(false);
    expect(trayectoValido({ lat: -26.83, lng: -65.2 }, { lat: -26.84, lng: -65.21 })).toBe(true);
  });
});

describe("comparación de presupuestos", () => {
  const lista = [p("a", 30_000, 4.9, 2), p("b", 25_000, null, 0, 9), p("c", 32_000, 4.6, 40, 15)];

  it("con pocas reseñas, el promedio se pondera: 40 reseñas de 4,6 pesan más que 2 de 4,9", () => {
    expect(ratingPonderado(lista[2]!)).toBeGreaterThan(ratingPonderado(lista[0]!));
    expect(ratingPonderado({ rating: null, calificaciones: 0 })).toBe(3.5);
  });

  it("ordena por precio, calificación o vencimiento", () => {
    expect(ordenarPresupuestos(lista, "precio").map((x) => x.id)).toEqual(["b", "a", "c"]);
    expect(ordenarPresupuestos(lista, "calificacion").map((x) => x.id)).toEqual(["c", "a", "b"]);
    expect(ordenarPresupuestos(lista, "vencimiento").map((x) => x.id)).toEqual(["b", "a", "c"]);
  });

  it("destaca el más barato y el mejor calificado (solo con reseñas y si hay con qué comparar)", () => {
    expect(destacados(lista)).toEqual({ masBarato: "b", mejorCalificado: "c" });
    expect(destacados([p("solo", 1000, 5, 3)])).toEqual({ masBarato: null, mejorCalificado: null });
    expect(destacados([p("x", 1000, null, 0), p("y", 2000, null, 0)])).toEqual({
      masBarato: "x",
      mejorCalificado: null,
    });
  });
});
