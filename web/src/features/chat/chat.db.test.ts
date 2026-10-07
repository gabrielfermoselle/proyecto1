import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { fechaIsoAr, sumarDias } from "@/domain/fechas";
import { aceptarPresupuesto } from "@/features/clientes/presupuestos/actions";
import { cancelarFlete } from "@/features/fletes/actions";
import { prisma } from "@/lib/prisma";
import {
  crearAdmin,
  crearCliente,
  crearFletero,
  crearSolicitud,
  error,
  eventosDelChat,
  ok,
  presupuestar,
} from "../../../test/db/fabrica";
import { comoUsuario } from "../../../test/db/sesion";
import { enviarMensaje, marcarLeido, proponerHorario, responderPropuesta } from "./actions";

// El chat es el único canal entre cliente y fletero: estos tests fijan quién puede escribir,
// cuándo deja de poder, y que un reintento de red no duplique mensajes.

async function negociacion() {
  const cliente = await crearCliente();
  const fletero = await crearFletero();
  const solicitud = await crearSolicitud(cliente);
  const { presupuestoId, conversacionId } = await presupuestar(solicitud.id, fletero);
  return { cliente, fletero, solicitud, presupuestoId, conversacionId };
}

const texto = (conversacionId: string, t: string, clientId: string = randomUUID()) => ({
  conversacionId,
  clientId,
  texto: t,
});

const textosDe = (conversacionId: string) =>
  prisma.mensaje
    .findMany({
      where: { conversacionId, tipo: "TEXTO" },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      select: { contenido: true, autorId: true },
    })
    .then((ms) => ms);

describe("enviarMensaje: quién puede escribir", () => {
  it("cliente y fletero de la conversación pueden escribirse", async () => {
    const { cliente, fletero, conversacionId } = await negociacion();

    comoUsuario(cliente);
    ok(await enviarMensaje(texto(conversacionId, "¿Podés a la tarde?")));
    comoUsuario(fletero);
    ok(await enviarMensaje(texto(conversacionId, "Sí, a las 17")));

    expect(await textosDe(conversacionId)).toEqual([
      { contenido: "¿Podés a la tarde?", autorId: cliente.id },
      { contenido: "Sí, a las 17", autorId: fletero.id },
    ]);
  });

  it("para un tercero la conversación no existe (cliente o fletero ajenos)", async () => {
    const { conversacionId } = await negociacion();
    const otroCliente = await crearCliente("Intrusa");
    const otroFletero = await crearFletero("Intruso");

    for (const intruso of [otroCliente, otroFletero]) {
      comoUsuario(intruso);
      expect(error(await enviarMensaje(texto(conversacionId, "hola")))).toMatch(
        /No encontramos esa conversación/,
      );
    }
    expect(await textosDe(conversacionId)).toEqual([]);
  });

  it("un administrador no participa del chat", async () => {
    const { conversacionId } = await negociacion();
    comoUsuario(await crearAdmin());

    expect(error(await enviarMensaje(texto(conversacionId, "hola")))).toMatch(/No tenés permiso/);
  });

  it("sin sesión no se puede escribir", async () => {
    const { conversacionId } = await negociacion();
    comoUsuario(null);

    expect(error(await enviarMensaje(texto(conversacionId, "hola")))).toMatch(/sesión expiró/);
  });

  it("si el cliente elige a otro fletero, la conversación del no elegido queda cerrada", async () => {
    const { cliente, fletero, solicitud, conversacionId } = await negociacion();
    const ganador = await crearFletero("Ganador");
    const { presupuestoId } = await presupuestar(solicitud.id, ganador);
    comoUsuario(cliente);
    ok(await aceptarPresupuesto({ presupuestoId }));

    comoUsuario(fletero);
    expect(error(await enviarMensaje(texto(conversacionId, "¿Y yo?")))).toMatch(/conversación está cerrada/);
    comoUsuario(cliente);
    expect(error(await enviarMensaje(texto(conversacionId, "Perdón")))).toMatch(/conversación está cerrada/);
  });

  it("si el flete se cancela, el chat queda bloqueado para los dos", async () => {
    const { cliente, fletero, presupuestoId, conversacionId } = await negociacion();
    comoUsuario(cliente);
    const { fleteId } = ok(await aceptarPresupuesto({ presupuestoId }));
    ok(await enviarMensaje(texto(conversacionId, "Te espero el jueves")));

    comoUsuario(fletero);
    ok(await cancelarFlete({ fleteId, motivo: "Se me rompió la camioneta" }));

    expect(error(await enviarMensaje(texto(conversacionId, "Disculpá")))).toMatch(/chat quedó bloqueado/);
    comoUsuario(cliente);
    expect(error(await enviarMensaje(texto(conversacionId, "¿Qué pasó?")))).toMatch(/chat quedó bloqueado/);
  });
});

describe("enviarMensaje: contenido", () => {
  it("un reintento con el mismo clientId devuelve el mismo mensaje sin duplicarlo", async () => {
    const { cliente, conversacionId } = await negociacion();
    comoUsuario(cliente);
    const clientId = randomUUID();

    const primero = ok(await enviarMensaje(texto(conversacionId, "Hola", clientId)));
    const reintento = ok(await enviarMensaje(texto(conversacionId, "Hola", clientId)));

    expect(reintento.id).toBe(primero.id);
    expect(await textosDe(conversacionId)).toHaveLength(1);
  });

  it("sanitiza: quita caracteres invisibles y colapsa saltos de línea", async () => {
    const { cliente, conversacionId } = await negociacion();
    comoUsuario(cliente);

    // U+202E (invierte el texto) y U+200B (ancho cero) se usan para disfrazar mensajes.
    ok(await enviarMensaje(texto(conversacionId, "  Hola‮​\n\n\n\nfletero  ")));

    expect((await textosDe(conversacionId))[0]?.contenido).toBe("Hola\n\nfletero");
  });

  it.each([
    ["vacío", ""],
    ["solo espacios y saltos", "   \n\n  "],
    ["solo caracteres invisibles", "​‮"],
  ])("rechaza un mensaje %s", async (_caso, t) => {
    const { cliente, conversacionId } = await negociacion();
    comoUsuario(cliente);

    const r = await enviarMensaje(texto(conversacionId, t));
    expect(r.ok ? [] : r.fieldErrors?.texto).toEqual([expect.stringMatching(/Escribí un mensaje/)]);
  });

  it("rechaza un mensaje de más de 2000 caracteres", async () => {
    const { cliente, conversacionId } = await negociacion();
    comoUsuario(cliente);

    const r = await enviarMensaje(texto(conversacionId, "a".repeat(2001)));
    expect(r.ok).toBe(false);
    expect(await textosDe(conversacionId)).toEqual([]);
  });

  it("frena el spam: más de 20 mensajes por minuto en una conversación", async () => {
    const { cliente, conversacionId } = await negociacion();
    comoUsuario(cliente);

    for (let i = 0; i < 20; i++) ok(await enviarMensaje(texto(conversacionId, `mensaje ${i}`)));
    expect(error(await enviarMensaje(texto(conversacionId, "uno más")))).toMatch(/muy rápido/);
    expect(await textosDe(conversacionId)).toHaveLength(20);
  });
});

describe("marcarLeido", () => {
  it("adelanta la marca de lectura y nunca la atrasa", async () => {
    const { cliente, conversacionId } = await negociacion();
    comoUsuario(cliente);
    const ahora = new Date();
    const antes = new Date(ahora.getTime() - 60_000);

    ok(await marcarLeido({ conversacionId, hasta: ahora.toISOString() }));
    ok(await marcarLeido({ conversacionId, hasta: antes.toISOString() }));

    const c = await prisma.conversacion.findUniqueOrThrow({ where: { id: conversacionId } });
    expect(c.leidoHastaCliente?.getTime()).toBe(ahora.getTime());
    expect(c.leidoHastaFletero).toBeNull();
  });

  it("no acepta marcar como leído el futuro (mensajes que todavía no llegaron)", async () => {
    const { fletero, conversacionId } = await negociacion();
    comoUsuario(fletero);
    const futuro = new Date(Date.now() + 3600_000);

    const { hasta } = ok(await marcarLeido({ conversacionId, hasta: futuro.toISOString() }));

    expect(new Date(hasta).getTime()).toBeLessThanOrEqual(Date.now());
  });

  it("un tercero no puede tocar las marcas de lectura", async () => {
    const { conversacionId } = await negociacion();
    comoUsuario(await crearCliente("Intrusa"));

    expect(error(await marcarLeido({ conversacionId, hasta: new Date().toISOString() }))).toMatch(
      /No encontramos/,
    );
  });
});

describe("propuestas de horario", () => {
  const enDias = (n: number) => sumarDias(fechaIsoAr(), n);
  const propuesta = (conversacionId: string, dias: number) => ({
    conversacionId,
    clientId: randomUUID(),
    fecha: enDias(dias),
    franja: "TARDE" as const,
  });
  const propuestasDe = (conversacionId: string) =>
    prisma.propuestaHorario.findMany({
      where: { mensaje: { conversacionId } },
      orderBy: { mensaje: { createdAt: "asc" } },
      select: { id: true, estado: true },
    });

  it("en negociación: el fletero propone, el cliente acepta y queda acordada sin aplicarse", async () => {
    const { cliente, fletero, solicitud, conversacionId } = await negociacion();
    comoUsuario(fletero);
    ok(await proponerHorario(propuesta(conversacionId, 5)));
    const [p] = await propuestasDe(conversacionId);

    comoUsuario(cliente);
    expect(ok(await responderPropuesta({ propuestaId: p!.id, aceptar: true }))).toEqual({
      estado: "ACEPTADA",
    });

    expect(await eventosDelChat(solicitud.id, fletero.fleteroProfile!.id)).toContain("FECHA_ACORDADA");
    // La fecha de la solicitud no cambia hasta que el cliente acepte ese presupuesto.
    const s = await prisma.solicitud.findUniqueOrThrow({ where: { id: solicitud.id } });
    expect(s.franja).toBe("MANANA");
  });

  it("al aceptar el presupuesto se aplica la fecha que acordaron en el chat", async () => {
    const { cliente, fletero, solicitud, presupuestoId, conversacionId } = await negociacion();
    comoUsuario(fletero);
    ok(await proponerHorario(propuesta(conversacionId, 5)));
    const [p] = await propuestasDe(conversacionId);
    comoUsuario(cliente);
    ok(await responderPropuesta({ propuestaId: p!.id, aceptar: true }));

    ok(await aceptarPresupuesto({ presupuestoId }));

    const s = await prisma.solicitud.findUniqueOrThrow({ where: { id: solicitud.id } });
    expect(s.fecha.toISOString().slice(0, 10)).toBe(enDias(5));
    expect(s.franja).toBe("TARDE");
  });

  it("con el flete confirmado, la fecha aceptada se aplica al instante", async () => {
    const { cliente, fletero, solicitud, presupuestoId, conversacionId } = await negociacion();
    comoUsuario(cliente);
    ok(await aceptarPresupuesto({ presupuestoId }));
    ok(await proponerHorario(propuesta(conversacionId, 7)));
    const [p] = await propuestasDe(conversacionId);

    comoUsuario(fletero);
    ok(await responderPropuesta({ propuestaId: p!.id, aceptar: true }));

    const s = await prisma.solicitud.findUniqueOrThrow({ where: { id: solicitud.id } });
    expect(s.fecha.toISOString().slice(0, 10)).toBe(enDias(7));
  });

  it("nadie puede responder su propia propuesta", async () => {
    const { fletero, conversacionId } = await negociacion();
    comoUsuario(fletero);
    ok(await proponerHorario(propuesta(conversacionId, 5)));
    const [p] = await propuestasDe(conversacionId);

    expect(error(await responderPropuesta({ propuestaId: p!.id, aceptar: true }))).toMatch(
      /tu propia propuesta/,
    );
  });

  it("una propuesta nueva anula la pendiente, que ya no se puede aceptar", async () => {
    const { cliente, fletero, conversacionId } = await negociacion();
    comoUsuario(fletero);
    ok(await proponerHorario(propuesta(conversacionId, 4)));
    ok(await proponerHorario(propuesta(conversacionId, 6)));
    const [vieja, nueva] = await propuestasDe(conversacionId);
    expect([vieja!.estado, nueva!.estado]).toEqual(["ANULADA", "PENDIENTE"]);

    comoUsuario(cliente);
    expect(error(await responderPropuesta({ propuestaId: vieja!.id, aceptar: true }))).toMatch(
      /respondida o reemplazada/,
    );
  });

  it("una propuesta ya respondida no se puede volver a responder", async () => {
    const { cliente, fletero, conversacionId } = await negociacion();
    comoUsuario(fletero);
    ok(await proponerHorario(propuesta(conversacionId, 5)));
    const [p] = await propuestasDe(conversacionId);
    comoUsuario(cliente);
    ok(await responderPropuesta({ propuestaId: p!.id, aceptar: false }));

    expect(error(await responderPropuesta({ propuestaId: p!.id, aceptar: true }))).toMatch(
      /respondida o reemplazada/,
    );
  });

  it("un tercero no puede responder: para él la propuesta no existe", async () => {
    const { fletero, conversacionId } = await negociacion();
    comoUsuario(fletero);
    ok(await proponerHorario(propuesta(conversacionId, 5)));
    const [p] = await propuestasDe(conversacionId);

    comoUsuario(await crearCliente("Intrusa"));
    expect(error(await responderPropuesta({ propuestaId: p!.id, aceptar: true }))).toMatch(
      /No encontramos esa propuesta/,
    );
  });

  it.each([
    ["en el pasado", -1],
    ["a más de 90 días", 91],
  ])("rechaza una fecha %s", async (_caso, dias) => {
    const { fletero, conversacionId } = await negociacion();
    comoUsuario(fletero);

    const r = await proponerHorario(propuesta(conversacionId, dias));
    expect(r.ok ? [] : r.fieldErrors?.fecha).toEqual([expect.stringMatching(/entre hoy y los próximos 90/)]);
  });

  it("con el flete en marcha ya no se puede cambiar la fecha", async () => {
    const { cliente, fletero, presupuestoId, conversacionId } = await negociacion();
    comoUsuario(cliente);
    const { fleteId } = ok(await aceptarPresupuesto({ presupuestoId }));
    await prisma.flete.update({ where: { id: fleteId }, data: { etapa: "EN_CAMINO_A_ORIGEN" } });

    comoUsuario(fletero);
    expect(error(await proponerHorario(propuesta(conversacionId, 5)))).toMatch(/flete está en curso/);
  });
});
