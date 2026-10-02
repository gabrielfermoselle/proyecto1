import { describe, expect, it } from "vitest";
import {
  admitePropuestas,
  contactoVisible,
  estadoConversacion,
  estaLeido,
  MARCA_CONTACTO_OCULTO,
  ocultarContacto,
  puedeEscribir,
  sanitizarTexto,
  segmentarTexto,
  type DatosEstadoConversacion,
} from "./chat";

const AHORA = new Date("2026-10-01T15:00:00Z");
const MANANA = new Date("2026-10-02T15:00:00Z");
const AYER = new Date("2026-09-30T15:00:00Z");

const base: DatosEstadoConversacion = {
  solicitudEstado: "ABIERTA",
  presupuesto: { estado: "PENDIENTE", validoHasta: MANANA },
  fleteEtapa: null,
};

describe("estadoConversacion", () => {
  it("negocia mientras el presupuesto está pendiente y vigente", () => {
    expect(estadoConversacion(base, AHORA)).toBe("NEGOCIACION");
  });

  it("se cierra si el presupuesto venció, fue retirado o rechazado", () => {
    expect(
      estadoConversacion({ ...base, presupuesto: { estado: "PENDIENTE", validoHasta: AYER } }, AHORA),
    ).toBe("CERRADA");
    expect(
      estadoConversacion({ ...base, presupuesto: { estado: "RETIRADO", validoHasta: MANANA } }, AHORA),
    ).toBe("CERRADA");
    expect(
      estadoConversacion({ ...base, presupuesto: { estado: "RECHAZADO", validoHasta: MANANA } }, AHORA),
    ).toBe("CERRADA");
  });

  it("se cierra si la solicitud se adjudicó a otro o se canceló", () => {
    expect(estadoConversacion({ ...base, solicitudEstado: "ADJUDICADA" }, AHORA)).toBe("CERRADA");
    expect(estadoConversacion({ ...base, solicitudEstado: "CANCELADA" }, AHORA)).toBe("CERRADA");
  });

  it("queda activa con un flete en curso, aunque el presupuesto ya esté aceptado", () => {
    for (const etapa of ["CONFIRMADO", "CARGADO", "EN_TRANSITO", "ENTREGADO"] as const) {
      expect(
        estadoConversacion(
          {
            solicitudEstado: "ADJUDICADA",
            presupuesto: { estado: "ACEPTADO", validoHasta: AYER },
            fleteEtapa: etapa,
          },
          AHORA,
        ),
      ).toBe("ACTIVA");
    }
  });

  it("se bloquea si el flete se canceló y se cierra cuando se completa", () => {
    expect(
      estadoConversacion({ ...base, solicitudEstado: "CANCELADA", fleteEtapa: "CANCELADO" }, AHORA),
    ).toBe("BLOQUEADA");
    expect(
      estadoConversacion({ ...base, solicitudEstado: "ADJUDICADA", fleteEtapa: "COMPLETADO" }, AHORA),
    ).toBe("CERRADA");
  });

  it("solo se escribe en negociación o con el flete activo", () => {
    expect(puedeEscribir("NEGOCIACION")).toBe(true);
    expect(puedeEscribir("ACTIVA")).toBe(true);
    expect(puedeEscribir("CERRADA")).toBe(false);
    expect(puedeEscribir("BLOQUEADA")).toBe(false);
  });

  it("las propuestas de fecha valen en negociación o con el flete confirmado (antes de cargar)", () => {
    expect(admitePropuestas("NEGOCIACION", null)).toBe(true);
    expect(admitePropuestas("ACTIVA", "CONFIRMADO")).toBe(true);
    expect(admitePropuestas("ACTIVA", "CARGADO")).toBe(false);
  });
});

describe("contactoVisible", () => {
  it("solo con un flete acordado y no cancelado", () => {
    expect(contactoVisible(null)).toBe(false);
    expect(contactoVisible("CONFIRMADO")).toBe(true);
    expect(contactoVisible("COMPLETADO")).toBe(true);
    expect(contactoVisible("CANCELADO")).toBe(false);
  });
});

describe("estaLeido", () => {
  it("compara con la marca de lectura del otro", () => {
    expect(estaLeido(AYER, AHORA)).toBe(true);
    expect(estaLeido(AHORA, AHORA)).toBe(true);
    expect(estaLeido(MANANA, AHORA)).toBe(false);
    expect(estaLeido(AYER, null)).toBe(false);
  });
});

describe("sanitizarTexto", () => {
  it("quita caracteres invisibles y de dirección que sirven para disfrazar texto", () => {
    expect(sanitizarTexto("hola‮mundo​")).toBe("holamundo");
    expect(sanitizarTexto("a\u0000b\u0007c")).toBe("abc");
  });

  it("conserva los emojis compuestos (ZWJ)", () => {
    const familia = "👨‍👩‍👧";
    expect(sanitizarTexto(familia)).toBe(familia);
  });

  it("normaliza saltos de línea y recorta", () => {
    expect(sanitizarTexto("  hola\r\n\r\n\r\n\r\nchau  \n")).toBe("hola\n\nchau");
  });

  it("no interpreta HTML: el texto queda tal cual (React lo escapa al mostrar)", () => {
    expect(sanitizarTexto("<script>alert(1)</script>")).toBe("<script>alert(1)</script>");
  });

  it("un mensaje de solo espacios queda vacío", () => {
    expect(sanitizarTexto(" \n​\t ")).toBe("");
  });
});

describe("ocultarContacto", () => {
  it("oculta teléfonos en formatos habituales", () => {
    for (const telefono of [
      "3814112222",
      "381 411-2222",
      "+54 9 381 411 2222",
      "(0381) 15-411-2222",
      "4112222 3",
    ]) {
      expect(ocultarContacto(`llamame al ${telefono}`), telefono).toContain(MARCA_CONTACTO_OCULTO);
    }
  });

  it("oculta emails y links de WhatsApp", () => {
    expect(ocultarContacto("escribime a ana.perez@gmail.com")).toBe(`escribime a ${MARCA_CONTACTO_OCULTO}`);
    expect(ocultarContacto("wa.me/5493814112222")).toBe(MARCA_CONTACTO_OCULTO);
  });

  it("no toca montos, medidas, fechas ni horarios", () => {
    const texto = "Te lo hago por $30.000, la heladera mide 180 x 70 x 65, el 09/10 a las 9:30, son 2 cajas";
    expect(ocultarContacto(texto)).toBe(texto);
    expect(ocultarContacto("$ 1.500.000")).toBe("$ 1.500.000");
  });
});

describe("segmentarTexto", () => {
  it("separa los links http(s) y deja la puntuación final fuera", () => {
    expect(segmentarTexto("mirá https://ejemplo.com/a?b=1. dale")).toEqual([
      { tipo: "texto", valor: "mirá " },
      { tipo: "link", valor: "https://ejemplo.com/a?b=1", href: "https://ejemplo.com/a?b=1" },
      { tipo: "texto", valor: ". dale" },
    ]);
  });

  it("no convierte en link otros esquemas", () => {
    expect(segmentarTexto("javascript:alert(1)")).toEqual([{ tipo: "texto", valor: "javascript:alert(1)" }]);
  });
});
