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
      RECLAMO_ABIERTO: { item: "Heladera" },
      FLETE_CERRADO: { reclamos: 0 },
    };
    for (const evento of Object.keys(ESQUEMAS_EVENTO)) {
      expect(textoEvento(evento, ejemplos[evento] ?? {}), evento).not.toBe("Actualización del flete.");
    }
  });

  it("la carga y la descarga resumen el inventario; los mensajes viejos sin conteos se siguen leyendo", () => {
    expect(textoEvento("CARGA_REGISTRADA", { cargados: 5, noCargados: 1, conObservacion: 2 })).toBe(
      "Carga registrada: se cargaron 5 ítems (1 ítem sin cargar, 2 ítems con observaciones). El fletero salió hacia el destino.",
    );
    expect(textoEvento("CARGA_REGISTRADA", {})).toBe(
      "Carga registrada: el fletero cargó todo lo de la lista.",
    );
    expect(textoEvento("DESCARGA_REGISTRADA", { entregados: 3, conDano: 1, faltantes: 0 })).toBe(
      "Descarga registrada: se entregaron 3 ítems, 1 ítem con daño. Falta que el cliente revise y confirme la recepción.",
    );
    expect(textoEvento("FLETE_CERRADO", { reclamos: 1 })).toBe(
      "El cliente confirmó la recepción y cerró el flete. Quedó registrado 1 reclamo.",
    );
    expect(textoEvento("DESCARGA_REGISTRADA", { entregados: 1, conDano: 0, faltantes: 2 })).toBe(
      "Descarga registrada: se entregó 1 ítem, 2 ítems faltantes. Falta que el cliente revise y confirme la recepción.",
    );
  });

  it("con un evento desconocido o datos inválidos usa un texto genérico", () => {
    expect(textoEvento("INVENTADO", {})).toBe("Actualización del flete.");
    expect(textoEvento(null, {})).toBe("Actualización del flete.");
    expect(textoEvento("PRESUPUESTO_ENVIADO", { monto: "mucho" })).toBe("Actualización del flete.");
  });
});
