import { describe, expect, it } from "vitest";
import { sesionVigente } from "./sesion";

const CAMBIO = new Date("2026-10-07T12:00:00Z");

describe("sesionVigente", () => {
  it("si nunca cambió la contraseña, toda sesión vale (incluso las de antes del claim)", () => {
    expect(sesionVigente(undefined, null)).toBe(true);
    expect(sesionVigente(Date.parse("2026-01-01T00:00:00Z"), null)).toBe(true);
  });

  it("una sesión iniciada antes del cambio ya no vale", () => {
    expect(sesionVigente(CAMBIO.getTime() - 1, CAMBIO)).toBe(false);
  });

  it("una sesión iniciada después del cambio (o en el mismo instante) vale", () => {
    expect(sesionVigente(CAMBIO.getTime(), CAMBIO)).toBe(true);
    expect(sesionVigente(CAMBIO.getTime() + 60_000, CAMBIO)).toBe(true);
  });

  it("un token viejo sin el claim no vale si la contraseña cambió", () => {
    expect(sesionVigente(undefined, CAMBIO)).toBe(false);
  });
});
