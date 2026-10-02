import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { crearCliente, crearFletero, crearSolicitud, dia } from "../../../test/db/fabrica";
import { avisarFletesDemorados, limpiarSubidasAbandonadas, vencerSolicitudes } from "./servicio";

describe("mantenimiento diario", () => {
  it("vence las solicitudes abiertas de días pasados, una sola vez", async () => {
    const cliente = await crearCliente();
    const vieja = await crearSolicitud(cliente, { fecha: dia(-2) });
    const vigente = await crearSolicitud(cliente, { fecha: dia(1) });

    expect(await vencerSolicitudes()).toBeGreaterThanOrEqual(1);
    const estados = await prisma.solicitud.findMany({
      where: { id: { in: [vieja.id, vigente.id] } },
      select: { id: true, estado: true },
    });
    expect(estados.find((s) => s.id === vieja.id)?.estado).toBe("VENCIDA");
    expect(estados.find((s) => s.id === vigente.id)?.estado).toBe("ABIERTA");
    await vencerSolicitudes();
    expect(
      await prisma.notificacion.count({
        where: { userId: cliente.id, clave: `solicitud-vencida:${vieja.id}` },
      }),
    ).toBe(1);
  });

  it("avisa una sola vez por los fletes que quedaron sin empezar", async () => {
    const cliente = await crearCliente();
    const fletero = await crearFletero();
    const s = await crearSolicitud(cliente, { fecha: dia(-1), estado: "ADJUDICADA" });
    const p = await prisma.presupuesto.create({
      data: {
        solicitudId: s.id,
        fleteroId: fletero.fleteroProfile!.id,
        vehiculoId: fletero.vehiculoId,
        monto: 1000,
        montoSugerido: 1000,
        validoHasta: new Date(),
        estado: "ACEPTADO",
      },
    });
    const flete = await prisma.flete.create({
      data: {
        solicitudId: s.id,
        presupuestoId: p.id,
        clienteId: cliente.clienteProfile!.id,
        fleteroId: fletero.fleteroProfile!.id,
        vehiculoId: fletero.vehiculoId,
        precioAcordado: 1000,
      },
    });

    await avisarFletesDemorados();
    await avisarFletesDemorados();
    const avisos = await prisma.notificacion.findMany({
      where: { clave: `flete-demorado:${flete.id}` },
      select: { userId: true },
    });
    expect(avisos.map((a) => a.userId).sort()).toEqual([cliente.id, fletero.id].sort());
  });

  it("descarta las subidas abandonadas y conserva las recientes", async () => {
    const vieja = `test/${crypto.randomUUID()}.jpg`;
    const usada = `test/${crypto.randomUUID()}.jpg`;
    const reciente = `test/${crypto.randomUUID()}.jpg`;
    const haceDosDias = new Date(Date.now() - 48 * 3600 * 1000);
    await prisma.subidaPendiente.createMany({
      data: [
        { ruta: vieja, bucket: "fotos-privadas", createdAt: haceDosDias },
        { ruta: usada, bucket: "fotos-privadas", createdAt: haceDosDias },
        { ruta: reciente, bucket: "fotos-privadas" },
      ],
    });
    const cliente = await crearCliente();
    const s = await crearSolicitud(cliente);
    await prisma.foto.create({ data: { ruta: usada, solicitudId: s.id } });

    // La vieja se borra (la usada no cuenta como abandonada); la reciente queda pendiente.
    expect(await limpiarSubidasAbandonadas()).toBeGreaterThanOrEqual(1);
    const pendientes = await prisma.subidaPendiente.findMany({
      where: { ruta: { in: [vieja, usada, reciente] } },
      select: { ruta: true },
    });
    expect(pendientes.map((p) => p.ruta)).toEqual([reciente]);
    expect(await prisma.foto.count({ where: { ruta: usada } })).toBe(1);
  });
});
