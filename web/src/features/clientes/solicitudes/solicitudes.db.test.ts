import { beforeEach, describe, expect, it } from "vitest";
import { sumarDias, fechaIsoAr } from "@/domain/fechas";
import { aceptarPresupuesto } from "@/features/clientes/presupuestos/actions";
import { numero } from "@/lib/db";
import {
  crearCliente,
  crearFletero,
  crearSolicitud,
  dia,
  error,
  eventosDelChat,
  ok,
  presupuestar,
} from "../../../../test/db/fabrica";
import { comoUsuario } from "../../../../test/db/sesion";
import { contar, filas, insertar, uno } from "../../../../test/db/tabla";
import { agregarFotoSolicitud, cancelarSolicitud, crearSolicitud as publicar } from "./actions";
import type { SolicitudInput } from "./schemas";

const base = (): SolicitudInput => ({
  tipoFlete: "MUEBLES",
  titulo: "Heladera y lavarropas",
  descripcion: "",
  origenDireccion: "Av. Roca 420, Barrio Sur",
  origenLat: -26.8405,
  origenLng: -65.2062,
  origenPiso: "",
  origenAscensor: false,
  destinoDireccion: "Av. Mate de Luna 2400, Ciudadela",
  destinoLat: -26.8211,
  destinoLng: -65.2302,
  destinoPiso: 3,
  destinoAscensor: true,
  fecha: sumarDias(fechaIsoAr(), 2),
  franja: "TARDE",
  tipoVehiculoSugerido: "",
  ayudantesRequeridos: 1,
  items: [
    {
      nombre: "Heladera",
      cantidad: 1,
      largoCm: 180,
      anchoCm: 70,
      altoCm: 70,
      pesoKgAprox: 80,
      fragil: true,
    },
    {
      nombre: "Cajas",
      cantidad: 4,
      largoCm: "",
      anchoCm: "",
      altoCm: "",
      pesoKgAprox: "",
      estadoInicial: "CON_MARCAS",
    },
  ],
});

describe("publicar una solicitud", () => {
  beforeEach(async () => comoUsuario(await crearCliente()));

  it("guarda la solicitud con los totales de la carga y la distancia calculados en el servidor", async () => {
    const { id } = ok(await publicar(base()));
    const s = await uno<{
      estado: string;
      pesoTotalKg: unknown;
      volumenTotalM3: unknown;
      itemsSinMedidas: number;
      distanciaKm: unknown;
      destinoPiso: number | null;
    }>("solicitudes", { id });
    const items = await filas<{ nombre: string; fragil: boolean; estadoInicial: string }>(
      "items_inventario",
      { solicitudId: id },
      { columna: "orden" },
    );
    expect(s.estado).toBe("ABIERTA");
    expect(numero(s.pesoTotalKg)).toBe(80);
    // 180 × 70 × 70 cm = 0,882 m³, con el 25 % de estiba = 1,1025 → 1,103
    expect(numero(s.volumenTotalM3)).toBeCloseTo(1.103, 3);
    expect(s.itemsSinMedidas).toBe(1);
    expect(numero(s.distanciaKm)).toBeGreaterThan(2);
    expect(s.destinoPiso).toBe(3);
    expect(items.map((i) => ({ nombre: i.nombre, fragil: i.fragil, estadoInicial: i.estadoInicial }))).toEqual([
      { nombre: "Heladera", fragil: true, estadoInicial: "BUENO" },
      { nombre: "Cajas", fragil: false, estadoInicial: "CON_MARCAS" },
    ]);
  });

  it("rechaza fechas pasadas, el mismo lugar y puntos fuera de Tucumán", async () => {
    expect(error(await publicar({ ...base(), fecha: sumarDias(fechaIsoAr(), -1) }))).toMatch(/entre hoy/);
    expect(error(await publicar({ ...base(), destinoLat: -26.8405, destinoLng: -65.2062 }))).toMatch(
      /mismo lugar/,
    );
    const r = await publicar({ ...base(), origenLat: -34.6, origenLng: -58.4 });
    expect(error(r)).toBe("Revisá los datos marcados.");
    expect(!r.ok && r.fieldErrors?.origenDireccion).toBeTruthy();
  });

  it("un fletero no puede publicar", async () => {
    comoUsuario(await crearFletero());
    expect(error(await publicar(base()))).toBe("No tenés permiso para hacer esto.");
  });
});

describe("cancelar una solicitud", () => {
  it("rechaza los presupuestos pendientes y avisa a cada fletero en su chat", async () => {
    const cliente = await crearCliente();
    const [f1, f2] = [await crearFletero("Uno"), await crearFletero("Dos")];
    const s = await crearSolicitud(cliente);
    await presupuestar(s.id, f1);
    await presupuestar(s.id, f2);

    comoUsuario(cliente);
    ok(await cancelarSolicitud({ solicitudId: s.id }));

    const final = await uno<{ estado: string }>("solicitudes", { id: s.id });
    const presupuestos = await filas<{ estado: string }>("presupuestos", { solicitudId: s.id });
    expect(final.estado).toBe("CANCELADA");
    expect(presupuestos.map((p) => p.estado)).toEqual(["RECHAZADO", "RECHAZADO"]);
    expect(await eventosDelChat(s.id, f1.fleteroProfile!.id)).toEqual([
      "PRESUPUESTO_ENVIADO",
      "SOLICITUD_CANCELADA",
    ]);
    expect(await eventosDelChat(s.id, f2.fleteroProfile!.id)).toContain("SOLICITUD_CANCELADA");
    const avisos = (
      await Promise.all([
        filas<{ titulo: string }>("notificaciones", { userId: f1.id }),
        filas<{ titulo: string }>("notificaciones", { userId: f2.id }),
      ])
    )
      .flat()
      .filter((n) => n.titulo.includes("canceló")).length;
    expect(avisos).toBe(2);
    // Ya cancelada, no se puede cancelar de nuevo.
    expect(error(await cancelarSolicitud({ solicitudId: s.id }))).toMatch(/ya no se puede cancelar/);
  });

  it("otro cliente no puede cancelarla ni subirle fotos", async () => {
    const duenio = await crearCliente();
    const s = await crearSolicitud(duenio);
    comoUsuario(await crearCliente("Intruso"));
    expect(error(await cancelarSolicitud({ solicitudId: s.id }))).toMatch(/ya no se puede cancelar/);
    expect(
      error(
        await agregarFotoSolicitud({
          solicitudId: s.id,
          ruta: `solicitudes/${s.id}/x.jpg`,
          ancho: 10,
          alto: 10,
        }),
      ),
    ).toBe("No encontramos esa solicitud.");
    expect((await uno<{ estado: string }>("solicitudes", { id: s.id })).estado).toBe("ABIERTA");
  });
});

describe("aceptar un presupuesto", () => {
  it("crea el flete, rechaza los demás y deja los mensajes en cada chat", async () => {
    const cliente = await crearCliente();
    const [elegido, otro] = [await crearFletero("Elegido"), await crearFletero("Otro")];
    const s = await crearSolicitud(cliente);
    const { presupuestoId } = await presupuestar(s.id, elegido, 28_000);
    await presupuestar(s.id, otro, 25_000);

    comoUsuario(cliente);
    const { fleteId } = ok(await aceptarPresupuesto({ presupuestoId }));

    const flete = await uno<{ etapa: string; precioAcordado: unknown }>("fletes", { id: fleteId });
    const historial = await filas<{ etapa: string }>("estados_flete", { fleteId });
    expect(flete.etapa).toBe("CONFIRMADO");
    expect(numero(flete.precioAcordado)).toBe(28_000);
    expect(historial.map((h) => h.etapa)).toEqual(["CONFIRMADO"]);
    const presupuestos = await filas<{ id: string; estado: string }>("presupuestos", { solicitudId: s.id });
    expect(presupuestos.find((p) => p.id === presupuestoId)?.estado).toBe("ACEPTADO");
    expect(presupuestos.filter((p) => p.estado === "RECHAZADO")).toHaveLength(1);
    expect((await uno<{ estado: string }>("solicitudes", { id: s.id })).estado).toBe("ADJUDICADA");
    expect(await eventosDelChat(s.id, elegido.fleteroProfile!.id)).toContain("FLETE_CONFIRMADO");
    expect(await eventosDelChat(s.id, otro.fleteroProfile!.id)).toContain("PRESUPUESTO_NO_ELEGIDO");

    // Una segunda aceptación (doble clic, otra pestaña) no crea otro flete.
    expect(error(await aceptarPresupuesto({ presupuestoId }))).toMatch(/ya no está abierta/);
    expect(await contar("fletes", { solicitudId: s.id })).toBe(1);
  });

  it("aplica la fecha que se acordó en el chat", async () => {
    const cliente = await crearCliente();
    const fletero = await crearFletero();
    const s = await crearSolicitud(cliente, { fecha: dia(3), franja: "MANANA" });
    const { presupuestoId, conversacionId } = await presupuestar(s.id, fletero);
    const mensaje = await insertar<{ id: string }>("mensajes", {
      conversacionId,
      tipo: "PROPUESTA",
      autorId: fletero.id,
    });
    await insertar("propuestas_horario", {
      mensajeId: mensaje.id,
      fecha: dia(5),
      franja: "TARDE",
      estado: "ACEPTADA",
      propuestaPorId: fletero.id,
      respondidaPorId: cliente.id,
      respondidaEn: new Date(),
    });

    comoUsuario(cliente);
    ok(await aceptarPresupuesto({ presupuestoId }));
    const final = await uno<{ fecha: string; franja: string }>("solicitudes", { id: s.id });
    expect({ fecha: new Date(final.fecha), franja: final.franja }).toEqual({ fecha: dia(5), franja: "TARDE" });
    const propuesta = await uno<{ aplicadaEn: string | null }>("propuestas_horario", { mensajeId: mensaje.id });
    expect(propuesta.aplicadaEn).not.toBeNull();
  });

  it("no acepta un presupuesto vencido ni uno de otra persona", async () => {
    const cliente = await crearCliente();
    const fletero = await crearFletero();
    const s = await crearSolicitud(cliente);
    const vencido = await presupuestar(s.id, fletero, 20_000, new Date(Date.now() - 60_000));

    comoUsuario(await crearCliente("Otra"));
    expect(error(await aceptarPresupuesto({ presupuestoId: vencido.presupuestoId }))).toBe(
      "No encontramos ese presupuesto.",
    );
    comoUsuario(cliente);
    expect(error(await aceptarPresupuesto({ presupuestoId: vencido.presupuestoId }))).toMatch(/venció/);
    expect(await contar("fletes", { solicitudId: s.id })).toBe(0);
  });
});
