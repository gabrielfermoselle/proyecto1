import { describe, expect, it } from "vitest";
import {
  etapaActual,
  pasosDelCiclo,
  pendientesDeFase,
  puedeCancelar,
  RECORRIDO,
  resumenInventario,
  siguienteEtapa,
  textoConformidad,
  validarControl,
  validarQuitarControl,
  validarTransicion,
  type Actor,
  type ContextoTransicion,
  type EtapaCiclo,
  type ItemControlado,
} from "./ciclo-flete";

const TODAS: EtapaCiclo[] = [...RECORRIDO, "CANCELADO"];
const ACTORES: Actor[] = ["CLIENTE", "FLETERO"];

const item = (id: string, c: Partial<Omit<ItemControlado, "id">> = {}): ItemControlado => ({
  id,
  carga: null,
  descarga: null,
  recepcion: null,
  ...c,
});
const cargado = { resultado: "CARGADO" as const, observacion: null };
const noCargado = { resultado: "NO_CARGADO" as const, observacion: "El cliente lo dejó" };
const entregado = { resultado: "ENTREGADO" as const, observacion: null };
const conforme = { resultado: "CONFORME" as const, observacion: null };
const reclamo = { resultado: "RECLAMO" as const, observacion: "Llegó con la puerta rota" };

/** Contexto donde todas las condiciones se cumplen: aísla la regla de quién puede mover qué. */
const TODO_LISTO: ContextoTransicion = {
  inventario: resumenInventario([item("a", { carga: cargado, descarga: entregado, recepcion: conforme })]),
  conformidad: true,
  motivo: "Motivo suficientemente largo",
};

describe("validarTransicion: quién mueve cada etapa", () => {
  // La tabla completa: cualquier par (desde, hacia, actor) que no esté acá tiene que fallar.
  const PERMITIDAS: [EtapaCiclo, EtapaCiclo, Actor[]][] = [
    ["SOLICITADO", "PRESUPUESTADO", ["FLETERO"]],
    ["SOLICITADO", "CANCELADO", ["CLIENTE"]],
    ["PRESUPUESTADO", "CONFIRMADO", ["CLIENTE"]],
    ["PRESUPUESTADO", "CANCELADO", ["CLIENTE"]],
    ["CONFIRMADO", "EN_CAMINO_A_ORIGEN", ["FLETERO"]],
    ["CONFIRMADO", "CANCELADO", ["CLIENTE", "FLETERO"]],
    ["EN_CAMINO_A_ORIGEN", "CARGANDO", ["FLETERO"]],
    ["EN_CAMINO_A_ORIGEN", "CANCELADO", ["CLIENTE", "FLETERO"]],
    ["CARGANDO", "EN_TRASLADO", ["FLETERO"]],
    ["EN_TRASLADO", "DESCARGANDO", ["FLETERO"]],
    ["DESCARGANDO", "ENTREGADO", ["FLETERO"]],
    ["ENTREGADO", "CERRADO", ["CLIENTE"]],
  ];
  const permitida = (d: EtapaCiclo, h: EtapaCiclo, a: Actor) =>
    PERMITIDAS.some(([pd, ph, actores]) => pd === d && ph === h && actores.includes(a));

  for (const desde of TODAS) {
    for (const hacia of TODAS) {
      for (const actor of ACTORES) {
        // CARGANDO → CANCELADO depende del inventario: tiene su propio test.
        if (desde === "CARGANDO" && hacia === "CANCELADO") continue;
        const esperado = permitida(desde, hacia, actor);
        it(`${desde} → ${hacia} por ${actor}: ${esperado ? "sí" : "no"}`, () => {
          expect(validarTransicion(desde, hacia, actor, TODO_LISTO).ok).toBe(esperado);
        });
      }
    }
  }

  it("explica por qué no, distinguiendo etapa imposible de actor equivocado", () => {
    expect(validarTransicion("CONFIRMADO", "EN_TRASLADO", "FLETERO", TODO_LISTO)).toEqual({
      ok: false,
      motivo: "Ese cambio de estado no es posible desde la etapa actual.",
    });
    expect(validarTransicion("ENTREGADO", "CERRADO", "FLETERO", TODO_LISTO)).toEqual({
      ok: false,
      motivo: "Ese cambio de estado no te corresponde.",
    });
  });

  it("los estados finales no tienen salida", () => {
    for (const hacia of TODAS) {
      for (const actor of ACTORES) {
        expect(validarTransicion("CERRADO", hacia, actor, TODO_LISTO).ok).toBe(false);
        expect(validarTransicion("CANCELADO", hacia, actor, TODO_LISTO).ok).toBe(false);
      }
    }
  });
});

describe("validarTransicion: condiciones", () => {
  const ctx = (items: ItemControlado[], extra: Partial<ContextoTransicion> = {}): ContextoTransicion => ({
    inventario: resumenInventario(items),
    conformidad: false,
    motivo: null,
    ...extra,
  });

  it("no sale del origen con ítems sin resolver", () => {
    const r = validarTransicion(
      "CARGANDO",
      "EN_TRASLADO",
      "FLETERO",
      ctx([item("a", { carga: cargado }), item("b")]),
    );
    expect(r).toEqual({
      ok: false,
      motivo: "Resolvé todos los ítems: marcá cada uno como cargado o no cargado.",
    });
  });

  it("sale del origen con todo resuelto aunque algún ítem no se haya cargado", () => {
    const items = [item("a", { carga: cargado }), item("b", { carga: noCargado })];
    expect(validarTransicion("CARGANDO", "EN_TRASLADO", "FLETERO", ctx(items)).ok).toBe(true);
  });

  it("no sale del origen si no cargó nada", () => {
    const r = validarTransicion("CARGANDO", "EN_TRASLADO", "FLETERO", ctx([item("a", { carga: noCargado })]));
    expect(r.ok).toBe(false);
  });

  it("entregar exige resolver los ítems cargados y la conformidad del fletero", () => {
    const sinDescargar = [item("a", { carga: cargado }), item("b", { carga: noCargado })];
    expect(
      validarTransicion("DESCARGANDO", "ENTREGADO", "FLETERO", ctx(sinDescargar, { conformidad: true })).ok,
    ).toBe(false);
    // El no cargado no se descarga: con el cargado resuelto alcanza.
    const resueltos = [item("a", { carga: cargado, descarga: entregado }), item("b", { carga: noCargado })];
    expect(validarTransicion("DESCARGANDO", "ENTREGADO", "FLETERO", ctx(resueltos))).toEqual({
      ok: false,
      motivo: "Confirmá la conformidad de entrega.",
    });
    expect(
      validarTransicion("DESCARGANDO", "ENTREGADO", "FLETERO", ctx(resueltos, { conformidad: true })).ok,
    ).toBe(true);
  });

  it("cerrar exige revisar todos los ítems cargados y la conformidad del cliente; los reclamos no lo impiden", () => {
    const pendiente = [item("a", { carga: cargado, descarga: entregado })];
    expect(
      validarTransicion("ENTREGADO", "CERRADO", "CLIENTE", ctx(pendiente, { conformidad: true })).ok,
    ).toBe(false);
    const conReclamo = [item("a", { carga: cargado, descarga: entregado, recepcion: reclamo })];
    expect(validarTransicion("ENTREGADO", "CERRADO", "CLIENTE", ctx(conReclamo)).ok).toBe(false);
    expect(
      validarTransicion("ENTREGADO", "CERRADO", "CLIENTE", ctx(conReclamo, { conformidad: true })).ok,
    ).toBe(true);
  });

  it("cancelar un flete confirmado exige un motivo", () => {
    expect(validarTransicion("CONFIRMADO", "CANCELADO", "CLIENTE", ctx([], { motivo: "corto" })).ok).toBe(
      false,
    );
    expect(
      validarTransicion("CONFIRMADO", "CANCELADO", "CLIENTE", ctx([], { motivo: "Se postergó la mudanza" }))
        .ok,
    ).toBe(true);
    // Cancelar la solicitud (antes del flete) no lo pide.
    expect(validarTransicion("SOLICITADO", "CANCELADO", "CLIENTE", ctx([])).ok).toBe(true);
  });

  it("se puede cancelar en el origen solo si todavía no se cargó nada", () => {
    const motivo = "El cliente no estaba en el domicilio";
    expect(validarTransicion("CARGANDO", "CANCELADO", "FLETERO", ctx([item("a")], { motivo })).ok).toBe(true);
    expect(
      validarTransicion(
        "CARGANDO",
        "CANCELADO",
        "CLIENTE",
        ctx([item("a", { carga: noCargado })], { motivo }),
      ).ok,
    ).toBe(true);
    expect(
      validarTransicion("CARGANDO", "CANCELADO", "FLETERO", ctx([item("a", { carga: cargado })], { motivo })),
    ).toEqual({ ok: false, motivo: "Ya hay ítems cargados: el flete no se puede cancelar." });
  });
});

describe("siguienteEtapa y puedeCancelar", () => {
  it("guía al fletero por el camino feliz", () => {
    const pasos: EtapaCiclo[] = [];
    let etapa: EtapaCiclo | null = "CONFIRMADO";
    while (etapa) {
      pasos.push(etapa);
      etapa = siguienteEtapa(etapa, "FLETERO");
    }
    expect(pasos).toEqual([
      "CONFIRMADO",
      "EN_CAMINO_A_ORIGEN",
      "CARGANDO",
      "EN_TRASLADO",
      "DESCARGANDO",
      "ENTREGADO",
    ]);
  });

  it("al cliente le toca aceptar y cerrar", () => {
    expect(siguienteEtapa("PRESUPUESTADO", "CLIENTE")).toBe("CONFIRMADO");
    expect(siguienteEtapa("ENTREGADO", "CLIENTE")).toBe("CERRADO");
    expect(siguienteEtapa("EN_TRASLADO", "CLIENTE")).toBeNull();
    expect(siguienteEtapa("CERRADO", "CLIENTE")).toBeNull();
  });

  it("puedeCancelar respeta la etapa, el actor y lo cargado", () => {
    expect(puedeCancelar("CONFIRMADO", "CLIENTE")).toBe(true);
    expect(puedeCancelar("EN_CAMINO_A_ORIGEN", "FLETERO")).toBe(true);
    expect(puedeCancelar("EN_TRASLADO", "FLETERO")).toBe(false);
    expect(puedeCancelar("PRESUPUESTADO", "FLETERO")).toBe(false);
    expect(puedeCancelar("CARGANDO", "FLETERO", resumenInventario([item("a")]))).toBe(true);
    expect(puedeCancelar("CARGANDO", "FLETERO", resumenInventario([item("a", { carga: cargado })]))).toBe(
      false,
    );
  });
});

describe("etapaActual", () => {
  it("antes del flete se deriva de la solicitud", () => {
    expect(etapaActual({ solicitudEstado: "ABIERTA", presupuestosPendientes: 0, fleteEtapa: null })).toBe(
      "SOLICITADO",
    );
    expect(etapaActual({ solicitudEstado: "ABIERTA", presupuestosPendientes: 2, fleteEtapa: null })).toBe(
      "PRESUPUESTADO",
    );
    expect(etapaActual({ solicitudEstado: "VENCIDA", presupuestosPendientes: 1, fleteEtapa: null })).toBe(
      "CANCELADO",
    );
  });

  it("con flete, manda la etapa del flete", () => {
    expect(
      etapaActual({ solicitudEstado: "ADJUDICADA", presupuestosPendientes: 0, fleteEtapa: "EN_TRASLADO" }),
    ).toBe("EN_TRASLADO");
    expect(
      etapaActual({ solicitudEstado: "CANCELADA", presupuestosPendientes: 0, fleteEtapa: "CANCELADO" }),
    ).toBe("CANCELADO");
  });
});

describe("resumenInventario", () => {
  it("cuenta cargados, entregados, faltantes, daños y reclamos", () => {
    const r = resumenInventario([
      item("a", { carga: cargado, descarga: entregado, recepcion: conforme }),
      item("b", {
        carga: { resultado: "CARGADO", observacion: "Rayón previo en la tapa" },
        descarga: { resultado: "CON_DANO", observacion: "Pata floja" },
        recepcion: reclamo,
      }),
      item("c", { carga: cargado, descarga: { resultado: "FALTANTE", observacion: "No aparece" } }),
      item("d", { carga: noCargado }),
      item("e"),
    ]);
    expect(r).toEqual({
      total: 5,
      cargados: 3,
      noCargados: 1,
      pendientesCarga: 1,
      conObservacionAlCargar: 1,
      entregados: 1,
      conDano: 1,
      faltantes: 1,
      pendientesDescarga: 0,
      conformes: 1,
      reclamos: 1,
      pendientesRecepcion: 1,
    });
  });

  it("pendientesDeFase ignora en descarga y recepción lo que no se cargó", () => {
    const items = [item("a", { carga: cargado }), item("b", { carga: noCargado }), item("c")];
    expect(pendientesDeFase(items, "CARGA").map((i) => i.id)).toEqual(["c"]);
    expect(pendientesDeFase(items, "DESCARGA").map((i) => i.id)).toEqual(["a"]);
    expect(pendientesDeFase(items, "RECEPCION").map((i) => i.id)).toEqual(["a"]);
  });
});

describe("validarControl", () => {
  const base = {
    etapa: "CARGANDO" as const,
    fase: "CARGA" as const,
    actor: "FLETERO" as const,
    resultado: "CARGADO" as const,
    observacion: null,
    item: item("a"),
  };

  it("el fletero marca la carga en CARGANDO, con observación opcional", () => {
    expect(validarControl(base).ok).toBe(true);
    expect(validarControl({ ...base, observacion: "Rayón previo" }).ok).toBe(true);
  });

  it("solo en la etapa de su fase y por quien corresponde", () => {
    expect(validarControl({ ...base, etapa: "EN_TRASLADO" }).ok).toBe(false);
    expect(validarControl({ ...base, actor: "CLIENTE" }).ok).toBe(false);
    expect(
      validarControl({
        ...base,
        etapa: "ENTREGADO",
        fase: "RECEPCION",
        actor: "CLIENTE",
        resultado: "CONFORME",
        item: item("a", { carga: cargado }),
      }).ok,
    ).toBe(true);
  });

  it("el resultado tiene que ser de la fase", () => {
    expect(validarControl({ ...base, resultado: "ENTREGADO" }).ok).toBe(false);
  });

  it("los resultados negativos exigen contar qué pasó", () => {
    expect(validarControl({ ...base, resultado: "NO_CARGADO", observacion: "  " }).ok).toBe(false);
    expect(validarControl({ ...base, resultado: "NO_CARGADO", observacion: "No entraba" }).ok).toBe(true);
  });

  it("no se descarga ni se recibe lo que no se cargó", () => {
    const descarga = {
      ...base,
      etapa: "DESCARGANDO" as const,
      fase: "DESCARGA" as const,
      resultado: "ENTREGADO" as const,
    };
    expect(validarControl({ ...descarga, item: item("a", { carga: noCargado }) })).toEqual({
      ok: false,
      motivo: "Ese ítem no se cargó.",
    });
    expect(validarControl({ ...descarga, item: item("a", { carga: cargado }) }).ok).toBe(true);
  });

  it("un reclamo abierto no se modifica ni se deshace", () => {
    const conReclamo = item("a", { carga: cargado, descarga: entregado, recepcion: reclamo });
    const recepcion = { etapa: "ENTREGADO" as const, fase: "RECEPCION" as const, actor: "CLIENTE" as const };
    expect(
      validarControl({ ...recepcion, resultado: "CONFORME", observacion: null, item: conReclamo }).ok,
    ).toBe(false);
    expect(validarQuitarControl({ ...recepcion, item: conReclamo }).ok).toBe(false);
    const conConforme = item("a", { carga: cargado, descarga: entregado, recepcion: conforme });
    expect(validarQuitarControl({ ...recepcion, item: conConforme }).ok).toBe(true);
  });
});

describe("pasosDelCiclo", () => {
  const f = (h: number) => new Date(Date.UTC(2026, 9, 1, h));

  it("marca hechas, actual y pendientes, con la hora de las alcanzadas", () => {
    const pasos = pasosDelCiclo("CARGANDO", {
      SOLICITADO: f(8),
      PRESUPUESTADO: f(9),
      CONFIRMADO: f(10),
      EN_CAMINO_A_ORIGEN: f(11),
      CARGANDO: f(12),
    });
    expect(pasos.map((p) => p.estado)).toEqual([
      "hecho",
      "hecho",
      "hecho",
      "hecho",
      "actual",
      "pendiente",
      "pendiente",
      "pendiente",
      "pendiente",
    ]);
    expect(pasos[4]).toEqual({ etapa: "CARGANDO", estado: "actual", fecha: f(12) });
    expect(pasos[5]?.fecha).toBeNull();
  });

  it("CERRADO es el final: todo hecho", () => {
    expect(pasosDelCiclo("CERRADO", {}).every((p) => p.estado === "hecho")).toBe(true);
  });

  it("cancelado: solo lo alcanzado y la cancelación al final", () => {
    const pasos = pasosDelCiclo("CANCELADO", { SOLICITADO: f(8), CONFIRMADO: f(10), CANCELADO: f(11) });
    expect(pasos.map((p) => [p.etapa, p.estado])).toEqual([
      ["SOLICITADO", "hecho"],
      ["CONFIRMADO", "hecho"],
      ["CANCELADO", "cancelado"],
    ]);
  });
});

describe("textoConformidad", () => {
  it("deja por escrito los números del inventario al firmar", () => {
    const r = resumenInventario([
      item("a", { carga: cargado, descarga: entregado, recepcion: conforme }),
      item("b", {
        carga: cargado,
        descarga: { resultado: "FALTANTE", observacion: "No aparece" },
        recepcion: reclamo,
      }),
    ]);
    expect(textoConformidad("FLETERO", r)).toBe(
      "Declaro que entregué la carga según este inventario: de 2 ítems cargados, 1 entregado en buen estado, 0 con daño y 1 faltante.",
    );
    expect(textoConformidad("CLIENTE", r)).toBe(
      "Declaro que recibí la carga: de 2 ítems cargados, 1 recibido conforme y 1 con reclamo.",
    );
  });
});
