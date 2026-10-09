import { describe, expect, it } from "vitest";
import { crearCliente, crearFletero, crearSolicitud, dia } from "../../../test/db/fabrica";
import { contar, filas, insertar, insertarVarios, uno, unoONull } from "../../../test/db/tabla";
import { avisarFletesDemorados, limpiarSubidasAbandonadas, vencerSolicitudes } from "./servicio";

describe("mantenimiento diario", () => {
  it("vence las solicitudes abiertas de días pasados, una sola vez", async () => {
    const cliente = await crearCliente();
    const vieja = await crearSolicitud(cliente, { fecha: dia(-2) });
    const vigente = await crearSolicitud(cliente, { fecha: dia(1) });

    expect(await vencerSolicitudes()).toBeGreaterThanOrEqual(1);
    const estados = await Promise.all([
      uno<{ id: string; estado: string }>("solicitudes", { id: vieja.id }),
      uno<{ id: string; estado: string }>("solicitudes", { id: vigente.id }),
    ]);
    expect(estados.find((s) => s.id === vieja.id)?.estado).toBe("VENCIDA");
    expect(estados.find((s) => s.id === vigente.id)?.estado).toBe("ABIERTA");
    await vencerSolicitudes();
    expect(
      await contar("notificaciones", { userId: cliente.id, clave: `solicitud-vencida:${vieja.id}` }),
    ).toBe(1);
  });

  it("avisa una sola vez por los fletes que quedaron sin empezar", async () => {
    const cliente = await crearCliente();
    const fletero = await crearFletero();
    const s = await crearSolicitud(cliente, { fecha: dia(-1), estado: "ADJUDICADA" });
    const p = await insertar<{ id: string }>("presupuestos", {
      solicitudId: s.id,
      fleteroId: fletero.fleteroProfile!.id,
      vehiculoId: fletero.vehiculoId,
      monto: 1000,
      montoSugerido: 1000,
      validoHasta: new Date(),
      estado: "ACEPTADO",
    });
    const flete = await insertar<{ id: string }>("fletes", {
      solicitudId: s.id,
      presupuestoId: p.id,
      clienteId: cliente.clienteProfile!.id,
      fleteroId: fletero.fleteroProfile!.id,
      vehiculoId: fletero.vehiculoId,
      precioAcordado: 1000,
    });

    await avisarFletesDemorados();
    await avisarFletesDemorados();
    const avisos = await filas<{ userId: string }>("notificaciones", { clave: `flete-demorado:${flete.id}` });
    expect(avisos.map((a) => a.userId).sort()).toEqual([cliente.id, fletero.id].sort());
  });

  it("descarta las subidas abandonadas y conserva las recientes", async () => {
    const vieja = `test/${crypto.randomUUID()}.jpg`;
    const usada = `test/${crypto.randomUUID()}.jpg`;
    const reciente = `test/${crypto.randomUUID()}.jpg`;
    const haceDosDias = new Date(Date.now() - 48 * 3600 * 1000);
    await insertarVarios("subidas_pendientes", [
      { ruta: vieja, bucket: "fotos-privadas", createdAt: haceDosDias },
      { ruta: usada, bucket: "fotos-privadas", createdAt: haceDosDias },
      { ruta: reciente, bucket: "fotos-privadas" },
    ]);
    const cliente = await crearCliente();
    const s = await crearSolicitud(cliente);
    await insertar("fotos", { ruta: usada, solicitudId: s.id });

    // La vieja se borra (la usada no cuenta como abandonada); la reciente queda pendiente.
    expect(await limpiarSubidasAbandonadas()).toBeGreaterThanOrEqual(1);
    const pendientes = (
      await Promise.all(
        [vieja, usada, reciente].map((ruta) => unoONull<{ ruta: string }>("subidas_pendientes", { ruta })),
      )
    ).filter((p): p is { ruta: string } => p !== null);
    expect(pendientes.map((p) => p.ruta)).toEqual([reciente]);
    expect(await contar("fotos", { ruta: usada })).toBe(1);
  });
});
