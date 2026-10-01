import { describe, expect, it } from "vitest";
import { calcularMetricas } from "./metricas";

const AHORA = new Date("2026-10-15T15:00:00Z");

describe("calcularMetricas", () => {
  it("sin datos no divide por cero", () => {
    const m = calcularMetricas([], [], AHORA);
    expect(m.tasaAceptacion).toBeNull();
    expect(m.gananciasMes).toBe(0);
    expect(m.gananciasPorMes).toHaveLength(6);
    expect(m.gananciasPorMes.at(-1)).toEqual({ mes: "2026-10", total: 0 });
    expect(m.gananciasPorMes[0]?.mes).toBe("2026-05");
  });

  it("solo suma ganancias de fletes completados y las reparte por mes", () => {
    const m = calcularMetricas(
      [
        { etapa: "COMPLETADO", precioAcordado: 30_000, completadoEn: new Date("2026-10-02T12:00:00Z") },
        { etapa: "COMPLETADO", precioAcordado: 20_000, completadoEn: new Date("2026-09-20T12:00:00Z") },
        // Completado a las 23 h del 30/9 en Tucumán (02 h UTC del 1/10): es de septiembre.
        { etapa: "COMPLETADO", precioAcordado: 5_000, completadoEn: new Date("2026-10-01T02:00:00Z") },
        { etapa: "ENTREGADO", precioAcordado: 99_000, completadoEn: null },
        { etapa: "CANCELADO", precioAcordado: 50_000, completadoEn: null },
        // Fuera de la ventana de 6 meses: cuenta en el total pero no en el gráfico.
        { etapa: "COMPLETADO", precioAcordado: 1_000, completadoEn: new Date("2025-12-01T12:00:00Z") },
      ],
      [],
      AHORA,
    );
    expect(m.gananciasMes).toBe(30_000);
    expect(m.gananciasTotales).toBe(56_000);
    expect(m.fletesCompletados).toBe(4);
    expect(m.fletesEnCurso).toBe(1);
    expect(m.gananciasPorMes.find((x) => x.mes === "2026-09")?.total).toBe(25_000);
  });

  it("la tasa de aceptación ignora pendientes y retirados", () => {
    const m = calcularMetricas(
      [],
      ["ACEPTADO", "RECHAZADO", "RECHAZADO", "RECHAZADO", "PENDIENTE", "RETIRADO"],
      AHORA,
    );
    expect(m.tasaAceptacion).toBe(0.25);
    expect(m.presupuestosDecididos).toBe(4);
  });
});
