import { describe, expect, it } from "vitest";
import { codificarCursor, decodificarCursor } from "./cursor";

const AHORA = new Date("2026-10-01T15:00:00Z");

describe("cursor", () => {
  it("ida y vuelta", () => {
    const cursor = { createdAt: AHORA, id: "cm1abc" };
    expect(decodificarCursor(codificarCursor(cursor))).toEqual(cursor);
  });

  it("rechaza cursores inválidos o manipulados", () => {
    expect(decodificarCursor(null)).toBeNull();
    expect(decodificarCursor("no-es-base64-valido!!")).toBeNull();
    expect(decodificarCursor(Buffer.from("fecha-rota|id").toString("base64url"))).toBeNull();
    expect(
      decodificarCursor(Buffer.from(`${AHORA.toISOString()}|id'; drop`).toString("base64url")),
    ).toBeNull();
  });
});
