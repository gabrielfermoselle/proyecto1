import { describe, expect, it } from "vitest";
import {
  actualizarPropuesta,
  agruparPorDia,
  fusionarMensajes,
  ultimoConfirmado,
  type MensajeVista,
} from "./hilo";

const msg = (id: string, creadoEn: string, extra: Partial<MensajeVista> = {}): MensajeVista => ({
  id,
  clientId: null,
  tipo: "TEXTO",
  autorRol: "CLIENTE",
  texto: id,
  fotos: [],
  propuesta: null,
  creadoEn,
  cursor: id,
  ...extra,
});

const propuesta = (id: string, creadoEn: string, estado: "PENDIENTE" | "ACEPTADA" = "PENDIENTE") =>
  msg(id, creadoEn, {
    tipo: "PROPUESTA",
    propuesta: { id: `p-${id}`, fecha: "2026-10-09", franja: "MANANA", estado, propuestaPorRol: "FLETERO" },
  });

describe("fusionarMensajes", () => {
  it("ordena cronológicamente y no duplica el mismo id", () => {
    const actuales = [msg("b", "2026-10-01T10:02:00Z")];
    const resultado = fusionarMensajes(actuales, [
      msg("a", "2026-10-01T10:01:00Z"),
      msg("b", "2026-10-01T10:02:00Z"),
    ]);
    expect(resultado.map((m) => m.id)).toEqual(["a", "b"]);
  });

  it("el mensaje confirmado reemplaza a su versión optimista (mismo clientId)", () => {
    const optimista = msg("local-1", "2026-10-01T10:05:00Z", { clientId: "c1", envio: "enviando" });
    const confirmado = msg("srv-1", "2026-10-01T10:05:01Z", { clientId: "c1" });
    const resultado = fusionarMensajes([optimista], [confirmado]);
    expect(resultado).toHaveLength(1);
    expect(resultado[0]).toMatchObject({ id: "srv-1" });
    expect(resultado[0]?.envio).toBeUndefined();
  });

  it("si el aviso en vivo llega antes que la respuesta de la acción, no queda duplicado", () => {
    const optimista = msg("local-1", "2026-10-01T10:05:00Z", { clientId: "c1", envio: "enviando" });
    const confirmado = msg("srv-1", "2026-10-01T10:05:01Z", { clientId: "c1" });
    const trasAviso = fusionarMensajes([optimista], [confirmado]);
    const trasRespuesta = fusionarMensajes(trasAviso, [confirmado]);
    expect(trasRespuesta.map((m) => m.id)).toEqual(["srv-1"]);
  });

  it("una propuesta nueva deja como anuladas a las pendientes anteriores", () => {
    const resultado = fusionarMensajes(
      [propuesta("x", "2026-10-01T10:00:00Z")],
      [propuesta("y", "2026-10-01T11:00:00Z")],
    );
    expect(resultado.map((m) => m.propuesta?.estado)).toEqual(["ANULADA", "PENDIENTE"]);
  });

  it("no anula propuestas ya respondidas", () => {
    const resultado = fusionarMensajes(
      [propuesta("x", "2026-10-01T10:00:00Z", "ACEPTADA")],
      [propuesta("y", "2026-10-01T11:00:00Z")],
    );
    expect(resultado.map((m) => m.propuesta?.estado)).toEqual(["ACEPTADA", "PENDIENTE"]);
  });
});

describe("actualizarPropuesta y ultimoConfirmado", () => {
  it("cambia el estado de una propuesta por id", () => {
    const resultado = actualizarPropuesta([propuesta("x", "2026-10-01T10:00:00Z")], "p-x", "ACEPTADA");
    expect(resultado[0]?.propuesta?.estado).toBe("ACEPTADA");
  });

  it("ignora los mensajes que todavía se están enviando", () => {
    const lista = [
      msg("a", "2026-10-01T10:00:00Z"),
      msg("local", "2026-10-01T10:01:00Z", { envio: "enviando" }),
    ];
    expect(ultimoConfirmado(lista)?.id).toBe("a");
  });
});

describe("agruparPorDia", () => {
  it("separa por día de Tucumán (UTC−3)", () => {
    const grupos = agruparPorDia([
      msg("a", "2026-10-02T01:00:00Z"), // 1/10 22 h en Tucumán
      msg("b", "2026-10-02T04:00:00Z"), // 2/10 1 h
    ]);
    expect(grupos.map((g) => [g.dia, g.mensajes.map((m) => m.id)])).toEqual([
      ["2026-10-01", ["a"]],
      ["2026-10-02", ["b"]],
    ]);
  });
});
