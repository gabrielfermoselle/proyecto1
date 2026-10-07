import { describe, expect, it } from "vitest";
import { finDelDiaAr, fechaIsoDeDia } from "@/domain/fechas";
import { prisma } from "@/lib/prisma";
import {
  crearCliente,
  crearFletero,
  crearSolicitud,
  dia,
  error,
  eventosDelChat,
  ok,
} from "../../../../test/db/fabrica";
import { comoUsuario } from "../../../../test/db/sesion";
import { enviarPresupuesto, retirarPresupuesto } from "./actions";

// enviarPresupuesto es la acción de plata de la plataforma: todo lo que importa (acceso,
// compatibilidad, precio sugerido y vencimiento) se recalcula en el servidor. Estos tests
// verifican que el cliente no pueda torcer ninguna de esas reglas mandando otros datos.

type Fletero = Awaited<ReturnType<typeof crearFletero>>;

const base = (fletero: Fletero, solicitudId: string) => ({
  solicitudId,
  vehiculoId: fletero.vehiculoId,
  monto: 30_000,
  ayudantes: 0,
  validez: "48h" as const,
  mensaje: "",
});

async function escenario() {
  const cliente = await crearCliente();
  const fletero = await crearFletero();
  const solicitud = await crearSolicitud(cliente);
  return { cliente, fletero, solicitud };
}

async function presupuestoDe(solicitudId: string, fletero: Fletero) {
  return prisma.presupuesto.findUniqueOrThrow({
    where: { solicitudId_fleteroId: { solicitudId, fleteroId: fletero.fleteroProfile!.id } },
  });
}

describe("enviarPresupuesto", () => {
  it("crea el presupuesto, abre el chat y deja el mensaje del fletero como primer mensaje", async () => {
    const { fletero, solicitud } = await escenario();
    comoUsuario(fletero);

    ok(await enviarPresupuesto({ ...base(fletero, solicitud.id), mensaje: "Lo hago a la mañana" }));

    const p = await presupuestoDe(solicitud.id, fletero);
    expect(p.estado).toBe("PENDIENTE");
    expect(p.monto.toNumber()).toBe(30_000);
    expect(await eventosDelChat(solicitud.id, fletero.fleteroProfile!.id)).toEqual(["PRESUPUESTO_ENVIADO"]);
    const textos = await prisma.mensaje.findMany({
      where: { conversacion: { solicitudId: solicitud.id }, tipo: "TEXTO" },
      select: { contenido: true, autorId: true },
    });
    expect(textos).toEqual([{ contenido: "Lo hago a la mañana", autorId: fletero.id }]);
  });

  it("calcula el precio sugerido en el servidor con las tarifas del fletero", async () => {
    // Tarifas de la fábrica: mínimo $10.000 y $5.000 por ayudante. 3,2 km lineales × 1,3 × $1.000
    // = $4.160 < mínimo, así que el sugerido es $10.000 + 2 × $5.000.
    const { fletero, solicitud } = await escenario();
    comoUsuario(fletero);

    ok(await enviarPresupuesto({ ...base(fletero, solicitud.id), ayudantes: 2 }));

    const p = await presupuestoDe(solicitud.id, fletero);
    expect(p.montoSugerido.toNumber()).toBe(20_000);
    expect(p.incluyeAyudantes).toBe(2);
  });

  it("el vencimiento nunca pasa del día del flete", async () => {
    const cliente = await crearCliente();
    const fletero = await crearFletero();
    const manana = await crearSolicitud(cliente, { fecha: dia(1) });
    comoUsuario(fletero);

    ok(await enviarPresupuesto({ ...base(fletero, manana.id), validez: "7d" }));

    const p = await presupuestoDe(manana.id, fletero);
    expect(p.validoHasta.getTime()).toBe(finDelDiaAr(fechaIsoDeDia(dia(1))).getTime());
  });

  it("con validez de 24 h vence a las 24 h si el flete es más adelante", async () => {
    const { fletero, solicitud } = await escenario(); // flete en 3 días
    comoUsuario(fletero);
    const antes = Date.now();

    ok(await enviarPresupuesto({ ...base(fletero, solicitud.id), validez: "24h" }));

    const vence = (await presupuestoDe(solicitud.id, fletero)).validoHasta.getTime();
    expect(vence - antes).toBeGreaterThanOrEqual(24 * 3600 * 1000);
    expect(vence - antes).toBeLessThan(24 * 3600 * 1000 + 60_000);
  });

  it("no deja presupuestar dos veces la misma solicitud", async () => {
    const { fletero, solicitud } = await escenario();
    comoUsuario(fletero);
    ok(await enviarPresupuesto(base(fletero, solicitud.id)));

    expect(error(await enviarPresupuesto({ ...base(fletero, solicitud.id), monto: 1_000 }))).toMatch(
      /Ya enviaste un presupuesto/,
    );
    expect((await presupuestoDe(solicitud.id, fletero)).monto.toNumber()).toBe(30_000);
  });

  it("rechaza al fletero en pausa", async () => {
    const { fletero, solicitud } = await escenario();
    await prisma.fleteroProfile.update({
      where: { id: fletero.fleteroProfile!.id },
      data: { disponible: false },
    });
    comoUsuario(fletero);

    expect(error(await enviarPresupuesto(base(fletero, solicitud.id)))).toMatch(/Estás en pausa/);
    expect(await prisma.presupuesto.count({ where: { solicitudId: solicitud.id } })).toBe(0);
  });

  it("una solicitud fuera del radio de cobertura no existe para el fletero", async () => {
    const { fletero, solicitud } = await escenario();
    // Base en Concepción (~60 km del origen) con 10 km de radio.
    await prisma.fleteroProfile.update({
      where: { id: fletero.fleteroProfile!.id },
      data: { baseLat: -27.3436, baseLng: -65.5925, radioCoberturaKm: 10 },
    });
    comoUsuario(fletero);

    expect(error(await enviarPresupuesto(base(fletero, solicitud.id)))).toMatch(
      /No encontramos esa solicitud/,
    );
  });

  it("no acepta un vehículo que no puede llevar la carga", async () => {
    const { fletero, solicitud } = await escenario();
    await prisma.solicitud.update({ where: { id: solicitud.id }, data: { pesoTotalKg: 300 } });
    const moto = await prisma.vehiculo.create({
      data: {
        fleteroId: fletero.fleteroProfile!.id,
        tipo: "MOTO",
        marca: "Honda",
        modelo: "Wave",
        patente: `M${Date.now().toString().slice(-6)}`,
        capacidadKg: 20,
        volumenM3: 0.1,
      },
      select: { id: true },
    });
    comoUsuario(fletero);

    expect(error(await enviarPresupuesto({ ...base(fletero, solicitud.id), vehiculoId: moto.id }))).toMatch(
      /Excede el peso/,
    );
  });

  it("no acepta el vehículo de otro fletero", async () => {
    const { fletero, solicitud } = await escenario();
    const otro = await crearFletero("Otro");
    comoUsuario(fletero);

    expect(
      error(await enviarPresupuesto({ ...base(fletero, solicitud.id), vehiculoId: otro.vehiculoId })),
    ).toMatch(/vehículos activos/);
  });

  it("no acepta un vehículo propio dado de baja", async () => {
    const { fletero, solicitud } = await escenario();
    await prisma.vehiculo.update({ where: { id: fletero.vehiculoId }, data: { activo: false } });
    comoUsuario(fletero);

    expect(error(await enviarPresupuesto(base(fletero, solicitud.id)))).toMatch(/vehículos activos/);
  });

  it("una solicitud adjudicada ya no recibe presupuestos", async () => {
    const cliente = await crearCliente();
    const fletero = await crearFletero();
    const adjudicada = await crearSolicitud(cliente, { estado: "ADJUDICADA" });
    comoUsuario(fletero);

    expect(error(await enviarPresupuesto(base(fletero, adjudicada.id)))).toMatch(
      /No encontramos esa solicitud/,
    );
  });

  it("una solicitud de un día que ya pasó no recibe presupuestos", async () => {
    const cliente = await crearCliente();
    const fletero = await crearFletero();
    const vieja = await crearSolicitud(cliente, { fecha: dia(-1) });
    comoUsuario(fletero);

    expect(error(await enviarPresupuesto(base(fletero, vieja.id)))).toMatch(/No encontramos esa solicitud/);
  });

  it.each([
    ["por debajo del mínimo", 999, /mínimo es \$1\.000/],
    ["con centavos", 15_000.5, /sin centavos/],
    ["absurdamente alto", 50_000_001, /Revisá el monto/],
  ])("rechaza un monto %s", async (_caso, monto, mensaje) => {
    const { fletero, solicitud } = await escenario();
    comoUsuario(fletero);

    const r = await enviarPresupuesto({ ...base(fletero, solicitud.id), monto });
    expect(r.ok).toBe(false);
    expect(r.ok ? [] : r.fieldErrors?.monto).toEqual([expect.stringMatching(mensaje)]);
    expect(await prisma.presupuesto.count({ where: { solicitudId: solicitud.id } })).toBe(0);
  });

  it("un fletero con el onboarding incompleto no puede presupuestar", async () => {
    const { fletero, solicitud } = await escenario();
    await prisma.fleteroProfile.update({
      where: { id: fletero.fleteroProfile!.id },
      data: { onboardingCompletadoEn: null },
    });
    comoUsuario({ ...fletero, fleteroProfile: { ...fletero.fleteroProfile!, onboardingCompletadoEn: null } });

    expect(error(await enviarPresupuesto(base(fletero, solicitud.id)))).toMatch(/Terminá de configurar/);
  });
});

describe("retirarPresupuesto", () => {
  it("lo retira, avisa en el chat y no permite volver a presupuestar", async () => {
    const { fletero, solicitud } = await escenario();
    comoUsuario(fletero);
    ok(await enviarPresupuesto(base(fletero, solicitud.id)));
    const { id } = await presupuestoDe(solicitud.id, fletero);

    ok(await retirarPresupuesto({ presupuestoId: id }));

    expect((await presupuestoDe(solicitud.id, fletero)).estado).toBe("RETIRADO");
    expect(await eventosDelChat(solicitud.id, fletero.fleteroProfile!.id)).toEqual([
      "PRESUPUESTO_ENVIADO",
      "PRESUPUESTO_RETIRADO",
    ]);
    expect(error(await enviarPresupuesto(base(fletero, solicitud.id)))).toMatch(/Ya enviaste/);
  });

  it("no se puede retirar dos veces", async () => {
    const { fletero, solicitud } = await escenario();
    comoUsuario(fletero);
    ok(await enviarPresupuesto(base(fletero, solicitud.id)));
    const { id } = await presupuestoDe(solicitud.id, fletero);
    ok(await retirarPresupuesto({ presupuestoId: id }));

    expect(error(await retirarPresupuesto({ presupuestoId: id }))).toMatch(/ya no se puede retirar/);
  });

  it("un fletero no puede retirar el presupuesto de otro", async () => {
    const { fletero, solicitud } = await escenario();
    const intruso = await crearFletero("Intruso");
    comoUsuario(fletero);
    ok(await enviarPresupuesto(base(fletero, solicitud.id)));
    const { id } = await presupuestoDe(solicitud.id, fletero);

    comoUsuario(intruso);
    expect(error(await retirarPresupuesto({ presupuestoId: id }))).toMatch(/ya no se puede retirar/);
    expect((await presupuestoDe(solicitud.id, fletero)).estado).toBe("PENDIENTE");
  });
});
