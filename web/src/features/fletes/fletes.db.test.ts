import { describe, expect, it } from "vitest";
import { aceptarPresupuesto } from "@/features/clientes/presupuestos/actions";
import { numero } from "@/lib/db";
import {
  crearCliente,
  crearFletero,
  crearSolicitud,
  error,
  eventosDelChat,
  ok,
  presupuestar,
} from "../../../test/db/fabrica";
import { comoUsuario } from "../../../test/db/sesion";
import { filas, uno } from "../../../test/db/tabla";
import {
  avanzarEtapa,
  calificarFlete,
  cancelarFlete,
  marcarTodos,
  quitarControl,
  registrarControl,
} from "./actions";

/** Un flete confirmado entre un cliente y un fletero nuevos. */
async function fleteConfirmado(items = 2) {
  const cliente = await crearCliente();
  const fletero = await crearFletero();
  const s = await crearSolicitud(cliente, { items });
  const { presupuestoId } = await presupuestar(s.id, fletero);
  comoUsuario(cliente);
  const { fleteId } = ok(await aceptarPresupuesto({ presupuestoId }));
  return { cliente, fletero, solicitud: s, fleteId };
}

const ubicacion = { lat: -26.83, lng: -65.2, precisionM: 20 };

describe("flete de punta a punta por las acciones", () => {
  it("recorre todas las etapas con controles, reclamo, cierre y calificación", async () => {
    const { cliente, fletero, solicitud, fleteId } = await fleteConfirmado();
    const [a, b] = solicitud.items;

    comoUsuario(fletero);
    ok(await avanzarEtapa({ fleteId, hacia: "EN_CAMINO_A_ORIGEN", ubicacion }));
    ok(await avanzarEtapa({ fleteId, hacia: "CARGANDO", ubicacion }));
    ok(
      await registrarControl({
        fleteId,
        itemId: a!.id,
        fase: "CARGA",
        resultado: "CARGADO",
        observacion: "Rayón previo",
      }),
    );
    ok(await marcarTodos({ fleteId, fase: "CARGA" }));
    ok(await avanzarEtapa({ fleteId, hacia: "EN_TRASLADO", ubicacion }));
    ok(await avanzarEtapa({ fleteId, hacia: "DESCARGANDO", ubicacion }));
    ok(await marcarTodos({ fleteId, fase: "DESCARGA" }));
    expect(error(await avanzarEtapa({ fleteId, hacia: "ENTREGADO" }))).toMatch(/conformidad/);
    ok(await avanzarEtapa({ fleteId, hacia: "ENTREGADO", conformidad: true, ubicacion }));

    comoUsuario(cliente);
    expect(error(await calificarFlete({ fleteId, puntaje: 5 }))).toMatch(/cuando cierres/);
    ok(
      await registrarControl({
        fleteId,
        itemId: b!.id,
        fase: "RECEPCION",
        resultado: "RECLAMO",
        observacion: "Llegó rayado",
      }),
    );
    ok(await marcarTodos({ fleteId, fase: "RECEPCION" }));
    ok(await avanzarEtapa({ fleteId, hacia: "CERRADO", conformidad: true }));
    ok(await calificarFlete({ fleteId, puntaje: 4, comentario: "Bien, pero hubo un rayón" }));
    expect(error(await calificarFlete({ fleteId, puntaje: 5 }))).toMatch(/Ya calificaste/);

    const fila = await uno<{ etapa: string; recepcionConfirmadaEn: string | null }>("fletes", { id: fleteId });
    const conformidades = await filas<{ rol: string }>("conformidades", { fleteId });
    const reclamos = await filas<{ descripcion: string }>("reclamos", { fleteId });
    const historial = await filas<{ etapa: string; lat: number | null }>(
      "estados_flete",
      { fleteId },
      { columna: "createdAt" },
    );
    const flete = {
      etapa: fila.etapa,
      recepcionConfirmadaEn: fila.recepcionConfirmadaEn,
      conformidades: conformidades.map((c) => ({ rol: c.rol })),
      reclamos: reclamos.map((r) => ({ descripcion: r.descripcion })),
      historial: historial.map((h) => ({ etapa: h.etapa, lat: h.lat })),
    };
    expect(flete.etapa).toBe("CERRADO");
    expect(flete.recepcionConfirmadaEn).not.toBeNull();
    expect(flete.conformidades.map((c) => c.rol).sort()).toEqual(["CLIENTE", "FLETERO"]);
    expect(flete.reclamos).toEqual([{ descripcion: "Llegó rayado" }]);
    // La ubicación se guarda solo en las etapas del fletero.
    expect(flete.historial.map((h) => [h.etapa, h.lat !== null])).toEqual([
      ["CONFIRMADO", false],
      ["EN_CAMINO_A_ORIGEN", true],
      ["CARGANDO", true],
      ["EN_TRASLADO", true],
      ["DESCARGANDO", true],
      ["ENTREGADO", true],
      ["CERRADO", false],
    ]);
    expect(await eventosDelChat(solicitud.id, fletero.fleteroProfile!.id)).toEqual([
      "PRESUPUESTO_ENVIADO",
      "FLETE_CONFIRMADO",
      "EN_CAMINO_A_ORIGEN",
      "LLEGADA_ORIGEN",
      "CARGA_REGISTRADA",
      "LLEGADA_DESTINO",
      "DESCARGA_REGISTRADA",
      "RECLAMO_ABIERTO",
      "FLETE_CERRADO",
    ]);
    // La calificación actualiza el promedio desnormalizado del perfil.
    const perfil = await uno<{ ratingPromedio: unknown; cantidadCalificaciones: number }>("perfiles_fletero", {
      id: fletero.fleteroProfile!.id,
    });
    expect(perfil.cantidadCalificaciones).toBe(1);
    expect(numero(perfil.ratingPromedio)).toBe(4);
  });
});

describe("autorización y reglas", () => {
  it("otro fletero no ve ni toca el flete; el cliente no mueve etapas del fletero", async () => {
    const { cliente, fleteId } = await fleteConfirmado();
    comoUsuario(await crearFletero("Intruso"));
    expect(error(await avanzarEtapa({ fleteId, hacia: "EN_CAMINO_A_ORIGEN" }))).toBe(
      "No encontramos ese flete.",
    );
    expect(error(await cancelarFlete({ fleteId, motivo: "Quiero romper todo" }))).toBe(
      "No encontramos ese flete.",
    );
    comoUsuario(cliente);
    expect(error(await avanzarEtapa({ fleteId, hacia: "EN_CAMINO_A_ORIGEN" }))).toMatch(/no te corresponde/);
  });

  it("deshacer un control y cancelar antes de cargar", async () => {
    const { cliente, fletero, solicitud, fleteId } = await fleteConfirmado(1);
    comoUsuario(fletero);
    ok(await avanzarEtapa({ fleteId, hacia: "EN_CAMINO_A_ORIGEN" }));
    ok(await avanzarEtapa({ fleteId, hacia: "CARGANDO" }));
    const item = solicitud.items[0]!.id;
    ok(
      await registrarControl({
        fleteId,
        itemId: item,
        fase: "CARGA",
        resultado: "CARGADO",
        observacion: null,
      }),
    );
    comoUsuario(cliente);
    expect(error(await cancelarFlete({ fleteId, motivo: "Ya no lo necesito" }))).toMatch(/ítems cargados/);
    comoUsuario(fletero);
    ok(await quitarControl({ fleteId, itemId: item, fase: "CARGA" }));
    comoUsuario(cliente);
    ok(await cancelarFlete({ fleteId, motivo: "Ya no lo necesito" }));
    const flete = await uno<{ etapa: string }>("fletes", { id: fleteId });
    const solicitudFinal = await uno<{ estado: string }>("solicitudes", { id: solicitud.id });
    const historial = await filas<{ nota: string | null }>("estados_flete", { fleteId, etapa: "CANCELADO" });
    const final = {
      etapa: flete.etapa,
      solicitud: { estado: solicitudFinal.estado },
      historial: historial.map((h) => ({ nota: h.nota })),
    };
    expect(final).toEqual({
      etapa: "CANCELADO",
      solicitud: { estado: "CANCELADA" },
      historial: [{ nota: "Ya no lo necesito" }],
    });
  });

  it("valida los datos de entrada: motivo corto, ubicación inválida y foto ajena", async () => {
    const { fletero, solicitud, fleteId } = await fleteConfirmado(1);
    comoUsuario(fletero);
    expect(error(await cancelarFlete({ fleteId, motivo: "corto" }))).toBe("Revisá los datos marcados.");
    expect(
      error(
        await avanzarEtapa({
          fleteId,
          hacia: "EN_CAMINO_A_ORIGEN",
          ubicacion: { lat: 200, lng: 0, precisionM: 1 },
        }),
      ),
    ).toBe("Revisá los datos marcados.");
    ok(await avanzarEtapa({ fleteId, hacia: "EN_CAMINO_A_ORIGEN" }));
    ok(await avanzarEtapa({ fleteId, hacia: "CARGANDO" }));
    // Sin Supabase configurado no hay forma de verificar la foto: se rechaza.
    expect(
      error(
        await registrarControl({
          fleteId,
          itemId: solicitud.items[0]!.id,
          fase: "CARGA",
          resultado: "CARGADO",
          observacion: null,
          foto: { ruta: `fletes/${fleteId}/otro/x.jpg`, ancho: 10, alto: 10 },
        }),
      ),
    ).toMatch(/verificar la foto/);
  });
});
