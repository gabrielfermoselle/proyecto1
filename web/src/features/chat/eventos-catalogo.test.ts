import { describe, expect, it } from "vitest";
import { ESQUEMAS_EVENTO, textoEvento } from "./eventos-catalogo";

describe("textoEvento", () => {
  it("arma el texto con los datos del evento", () => {
    expect(
      textoEvento("PRESUPUESTO_ENVIADO", { monto: 30000, validoHasta: "2026-10-03T15:00:00.000Z" }),
    ).toMatch(/^Presupuesto enviado: \$\s?30\.000 · vale hasta el 3 oct/);
    expect(textoEvento("FECHA_ACORDADA", { fecha: "2026-10-09", franja: "MANANA", aplicada: true })).toBe(
      "Nueva fecha acordada: vie, 9 oct, mañana (8 a 12 h).",
    );
    expect(textoEvento("FLETE_CANCELADO", { motivo: "Se rompió el vehículo", por: "FLETERO" })).toContain(
      "«Se rompió el vehículo»",
    );
  });

  it("todos los eventos tienen texto", () => {
    const ejemplos: Record<string, unknown> = {
      PRESUPUESTO_ENVIADO: { monto: 1000, validoHasta: "2026-10-03T15:00:00.000Z" },
      FLETE_CONFIRMADO: { monto: 1000, fecha: "2026-10-09", franja: "TARDE" },
      FLETE_CANCELADO: { motivo: "x", por: "CLIENTE" },
      FECHA_ACORDADA: { fecha: "2026-10-09", franja: "TARDE", aplicada: false },
    };
    for (const evento of Object.keys(ESQUEMAS_EVENTO)) {
      expect(textoEvento(evento, ejemplos[evento] ?? {}), evento).not.toBe("Actualización del flete.");
    }
  });

  it("con un evento desconocido o datos inválidos usa un texto genérico", () => {
    expect(textoEvento("INVENTADO", {})).toBe("Actualización del flete.");
    expect(textoEvento(null, {})).toBe("Actualización del flete.");
    expect(textoEvento("PRESUPUESTO_ENVIADO", { monto: "mucho" })).toBe("Actualización del flete.");
  });
});
