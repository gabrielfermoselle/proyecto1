import { describe, expect, it, vi } from "vitest";
import { crearLogger, lineaDeLog } from "./log";
import { resolverRequestId } from "./request-id";

const AHORA = new Date("2026-10-07T15:00:00.000Z");

describe("lineaDeLog", () => {
  it("es una línea JSON con nivel, evento, momento, el contexto del request y los datos", () => {
    const linea = lineaDeLog("info", "cron.mantenimiento", { requestId: "req-12345678" }, { vencidas: 2 }, AHORA);
    expect(linea).not.toContain("\n");
    expect(JSON.parse(linea)).toEqual({
      nivel: "info",
      evento: "cron.mantenimiento",
      momento: "2026-10-07T15:00:00.000Z",
      requestId: "req-12345678",
      vencidas: 2,
    });
  });

  it("nunca escribe contraseñas, tokens, hashes ni secretos, aunque estén anidados", () => {
    const linea = lineaDeLog("error", "x", {}, {
      password: "clave1234",
      datos: { nueva: "ok", contrasenaActual: "a", tokenHash: "abc", headers: { authorization: "Bearer s" } },
      apiKey: "re_123",
    });
    for (const secreto of ["clave1234", "abc", "Bearer s", "re_123", "\"a\""]) expect(linea).not.toContain(secreto);
    expect(JSON.parse(linea).datos.nueva).toBe("ok");
    expect(JSON.parse(linea).password).toBe("[oculto]");
  });

  it("serializa errores con nombre, mensaje, código y un stack corto", () => {
    const error = Object.assign(new Error("se cortó la conexión"), { code: "P1001" });
    const { error: e } = JSON.parse(lineaDeLog("error", "action.error", {}, { error }));
    expect(e).toMatchObject({ nombre: "Error", mensaje: "se cortó la conexión", codigo: "P1001" });
    expect(e.stack.split("\n").length).toBeLessThanOrEqual(8);
  });

  it("soporta fechas, bigint y objetos profundos sin romperse", () => {
    const profundo = { a: { b: { c: { d: { e: { f: 1 } } } } } };
    const r = JSON.parse(lineaDeLog("info", "x", {}, { cuando: AHORA, grande: 10n, profundo }));
    expect(r.cuando).toBe("2026-10-07T15:00:00.000Z");
    expect(r.grande).toBe("10");
    expect(JSON.stringify(r.profundo)).toContain("[…]");
  });
});

describe("crearLogger", () => {
  it("escribe por console.error/warn/log según el nivel", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const info = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const logger = crearLogger({ requestId: "r1-abcdefg" });

    logger.error("a");
    logger.warn("b");
    logger.info("c");

    expect(JSON.parse(String(error.mock.calls[0]![0]))).toMatchObject({ nivel: "error", evento: "a", requestId: "r1-abcdefg" });
    expect(JSON.parse(String(warn.mock.calls[0]![0])).nivel).toBe("warn");
    expect(JSON.parse(String(info.mock.calls[0]![0])).nivel).toBe("info");
    vi.restoreAllMocks();
  });
});

describe("resolverRequestId", () => {
  it("reusa un id entrante con formato válido", () => {
    expect(resolverRequestId("abc-123_XYZ")).toBe("abc-123_XYZ");
  });

  it("genera uno nuevo si no hay, o si el entrante podría ensuciar los logs", () => {
    const uuid = /^[0-9a-f-]{36}$/;
    expect(resolverRequestId(null)).toMatch(uuid);
    expect(resolverRequestId('x"\n{"nivel":"falso"}')).toMatch(uuid);
    expect(resolverRequestId("corto")).toMatch(uuid);
    expect(resolverRequestId("a".repeat(65))).toMatch(uuid);
  });
});
