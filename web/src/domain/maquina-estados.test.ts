import { describe, expect, it } from "vitest";
import { faseInventario, puedeCancelar, siguienteEtapaFletero, validarTransicion } from "./maquina-estados";

const COMPLETO = { total: 3, cargados: 3, descargados: 3 };

describe("validarTransicion", () => {
  it("el fletero avanza etapa por etapa", () => {
    expect(validarTransicion("CONFIRMADO", "CARGADO", "FLETERO", COMPLETO)).toEqual({ ok: true });
    expect(validarTransicion("CARGADO", "EN_TRANSITO", "FLETERO", COMPLETO)).toEqual({ ok: true });
    expect(validarTransicion("EN_TRANSITO", "ENTREGADO", "FLETERO", COMPLETO)).toEqual({ ok: true });
  });

  it("no se pueden saltear etapas ni volver atrás", () => {
    expect(validarTransicion("CONFIRMADO", "EN_TRANSITO", "FLETERO", COMPLETO).ok).toBe(false);
    expect(validarTransicion("ENTREGADO", "CARGADO", "FLETERO", COMPLETO).ok).toBe(false);
    expect(validarTransicion("COMPLETADO", "CANCELADO", "CLIENTE", COMPLETO).ok).toBe(false);
  });

  it("solo el cliente confirma la recepción", () => {
    expect(validarTransicion("ENTREGADO", "COMPLETADO", "FLETERO", COMPLETO)).toEqual({
      ok: false,
      motivo: "Ese cambio de estado no te corresponde.",
    });
    expect(validarTransicion("ENTREGADO", "COMPLETADO", "CLIENTE", COMPLETO).ok).toBe(true);
  });

  it("exige el inventario cargado y descargado completo", () => {
    expect(
      validarTransicion("CONFIRMADO", "CARGADO", "FLETERO", { total: 3, cargados: 2, descargados: 0 }).ok,
    ).toBe(false);
    expect(
      validarTransicion("EN_TRANSITO", "ENTREGADO", "FLETERO", { total: 3, cargados: 3, descargados: 2 }).ok,
    ).toBe(false);
  });

  it("solo se cancela desde CONFIRMADO", () => {
    expect(validarTransicion("CONFIRMADO", "CANCELADO", "FLETERO", COMPLETO).ok).toBe(true);
    expect(validarTransicion("CARGADO", "CANCELADO", "FLETERO", COMPLETO).ok).toBe(false);
    expect(puedeCancelar("CONFIRMADO", "CLIENTE")).toBe(true);
    expect(puedeCancelar("EN_TRANSITO", "FLETERO")).toBe(false);
  });
});

describe("siguienteEtapaFletero", () => {
  it("indica el próximo paso del fletero, o null cuando ya no le toca", () => {
    expect(siguienteEtapaFletero("CONFIRMADO")).toBe("CARGADO");
    expect(siguienteEtapaFletero("CARGADO")).toBe("EN_TRANSITO");
    expect(siguienteEtapaFletero("EN_TRANSITO")).toBe("ENTREGADO");
    expect(siguienteEtapaFletero("ENTREGADO")).toBeNull();
    expect(siguienteEtapaFletero("CANCELADO")).toBeNull();
  });
});

describe("faseInventario", () => {
  it("se carga en CONFIRMADO y se descarga en EN_TRANSITO", () => {
    expect(faseInventario("CONFIRMADO")).toBe("carga");
    expect(faseInventario("EN_TRANSITO")).toBe("descarga");
    expect(faseInventario("CARGADO")).toBeNull();
  });
});
