// Ciclo de vida completo de un flete, quién puede mover cada etapa y el control del inventario.
// Puro: lo usan el servicio de transiciones, las queries, la UI y el comprobante.
//
//   SOLICITADO → PRESUPUESTADO → CONFIRMADO → EN_CAMINO_A_ORIGEN → CARGANDO → EN_TRASLADO
//             → DESCARGANDO → ENTREGADO → CERRADO
//
//   CANCELADO: desde SOLICITADO o PRESUPUESTADO (el cliente), desde CONFIRMADO o
//   EN_CAMINO_A_ORIGEN (cualquiera, con motivo) y desde CARGANDO solo si no se cargó nada.
//
// SOLICITADO y PRESUPUESTADO son etapas de la solicitud: el flete se crea recién cuando el
// cliente acepta un presupuesto, y desde ahí su etapa se guarda en la base.

import { ETIQUETA_ETAPA, type EtapaFlete, type FaseControl, type ResultadoControl } from "./catalogos";

export type Actor = "CLIENTE" | "FLETERO";
export type EtapaCiclo = "SOLICITADO" | "PRESUPUESTADO" | EtapaFlete;
export type Resultado = { ok: true } | { ok: false; motivo: string };

const OK: Resultado = { ok: true };
const error = (motivo: string): Resultado => ({ ok: false, motivo });

/** El camino feliz, en orden. */
export const RECORRIDO: readonly EtapaCiclo[] = [
  "SOLICITADO",
  "PRESUPUESTADO",
  "CONFIRMADO",
  "EN_CAMINO_A_ORIGEN",
  "CARGANDO",
  "EN_TRASLADO",
  "DESCARGANDO",
  "ENTREGADO",
  "CERRADO",
];

/** El tramo del recorrido que vive en el flete (desde que se confirma). */
export const RECORRIDO_FLETE = RECORRIDO.slice(2) as readonly EtapaFlete[];

export const ETIQUETA_CICLO: Record<EtapaCiclo, string> = {
  SOLICITADO: "Solicitado",
  PRESUPUESTADO: "Presupuestado",
  ...ETIQUETA_ETAPA,
};

export const DESCRIPCION_ETAPA: Record<EtapaCiclo, string> = {
  SOLICITADO: "Se publicó la solicitud.",
  PRESUPUESTADO: "Llegaron presupuestos de fleteros.",
  CONFIRMADO: "Se aceptó un presupuesto: el flete está acordado.",
  EN_CAMINO_A_ORIGEN: "El fletero salió a buscar la carga.",
  CARGANDO: "El fletero llegó al origen y está cargando ítem por ítem.",
  EN_TRASLADO: "La carga va camino al destino.",
  DESCARGANDO: "El fletero llegó al destino y está descargando.",
  ENTREGADO: "Se descargó todo. Falta que el cliente revise y confirme la recepción.",
  CERRADO: "El cliente confirmó la recepción. Flete terminado.",
  CANCELADO: "El flete se canceló.",
};

/** Fletes en curso: ocupan la agenda del fletero y fijan el chat. */
export const ETAPAS_ACTIVAS = [
  "CONFIRMADO",
  "EN_CAMINO_A_ORIGEN",
  "CARGANDO",
  "EN_TRASLADO",
  "DESCARGANDO",
  "ENTREGADO",
] as const satisfies readonly EtapaFlete[];

/** Mientras el fletero está en la calle, el cliente ve su última ubicación compartida. */
export const ETAPAS_EN_MOVIMIENTO = [
  "EN_CAMINO_A_ORIGEN",
  "CARGANDO",
  "EN_TRASLADO",
  "DESCARGANDO",
] as const satisfies readonly EtapaFlete[];

export const esEtapaActiva = (etapa: EtapaFlete) => (ETAPAS_ACTIVAS as readonly EtapaFlete[]).includes(etapa);
export const esEtapaEnMovimiento = (etapa: EtapaFlete) =>
  (ETAPAS_EN_MOVIMIENTO as readonly EtapaFlete[]).includes(etapa);

/** Etapa del ciclo a partir de la solicitud y, si ya existe, el flete. */
export function etapaActual(d: {
  solicitudEstado: "ABIERTA" | "ADJUDICADA" | "CANCELADA" | "VENCIDA";
  presupuestosPendientes: number;
  fleteEtapa: EtapaFlete | null;
}): EtapaCiclo {
  if (d.fleteEtapa) return d.fleteEtapa;
  // Una solicitud que se cerró sin flete (cancelada o vencida) terminó su ciclo.
  if (d.solicitudEstado === "CANCELADA" || d.solicitudEstado === "VENCIDA") return "CANCELADO";
  return d.presupuestosPendientes > 0 ? "PRESUPUESTADO" : "SOLICITADO";
}

// ---------------------------------------------------------------------------
// Inventario
// ---------------------------------------------------------------------------

export interface ControlRegistrado {
  resultado: ResultadoControl;
  observacion: string | null;
}

export interface ItemControlado {
  id: string;
  carga: ControlRegistrado | null;
  descarga: ControlRegistrado | null;
  recepcion: ControlRegistrado | null;
}

export interface ResumenInventario {
  total: number;
  cargados: number;
  noCargados: number;
  pendientesCarga: number;
  /** Cargados con una observación al cargar (p. ej. "rayón previo"). */
  conObservacionAlCargar: number;
  entregados: number;
  conDano: number;
  faltantes: number;
  pendientesDescarga: number;
  conformes: number;
  reclamos: number;
  pendientesRecepcion: number;
}

const fueCargado = (i: ItemControlado) => i.carga?.resultado === "CARGADO";

export function resumenInventario(items: readonly ItemControlado[]): ResumenInventario {
  const cuantos = (f: (i: ItemControlado) => boolean) => items.filter(f).length;
  return {
    total: items.length,
    cargados: cuantos(fueCargado),
    noCargados: cuantos((i) => i.carga?.resultado === "NO_CARGADO"),
    pendientesCarga: cuantos((i) => !i.carga),
    conObservacionAlCargar: cuantos((i) => fueCargado(i) && Boolean(i.carga?.observacion)),
    entregados: cuantos((i) => i.descarga?.resultado === "ENTREGADO"),
    conDano: cuantos((i) => i.descarga?.resultado === "CON_DANO"),
    faltantes: cuantos((i) => i.descarga?.resultado === "FALTANTE"),
    pendientesDescarga: cuantos((i) => fueCargado(i) && !i.descarga),
    conformes: cuantos((i) => i.recepcion?.resultado === "CONFORME"),
    reclamos: cuantos((i) => i.recepcion?.resultado === "RECLAMO"),
    pendientesRecepcion: cuantos((i) => fueCargado(i) && !i.recepcion),
  };
}

/** En qué etapa se registra cada fase del inventario. */
export const FASE_DE_ETAPA: Partial<Record<EtapaFlete, FaseControl>> = {
  CARGANDO: "CARGA",
  DESCARGANDO: "DESCARGA",
  ENTREGADO: "RECEPCION",
};

export const ACTOR_DE_FASE: Record<FaseControl, Actor> = {
  CARGA: "FLETERO",
  DESCARGA: "FLETERO",
  RECEPCION: "CLIENTE",
};

export const RESULTADOS_DE_FASE: Record<FaseControl, readonly ResultadoControl[]> = {
  CARGA: ["CARGADO", "NO_CARGADO"],
  DESCARGA: ["ENTREGADO", "CON_DANO", "FALTANTE"],
  RECEPCION: ["CONFORME", "RECLAMO"],
};

/** El resultado "todo bien" de cada fase: el del toque rápido y el de "marcar todo". */
export const RESULTADO_OK: Record<FaseControl, ResultadoControl> = {
  CARGA: "CARGADO",
  DESCARGA: "ENTREGADO",
  RECEPCION: "CONFORME",
};

const REQUIEREN_OBSERVACION: readonly ResultadoControl[] = ["NO_CARGADO", "CON_DANO", "FALTANTE", "RECLAMO"];
export const LARGO_MINIMO_OBSERVACION = 5;
export const requiereObservacion = (r: ResultadoControl) => REQUIEREN_OBSERVACION.includes(r);

/** Ítems que faltan resolver en una fase (los no cargados no se descargan ni se reciben). */
export function pendientesDeFase<T extends ItemControlado>(items: readonly T[], fase: FaseControl): T[] {
  switch (fase) {
    case "CARGA":
      return items.filter((i) => !i.carga);
    case "DESCARGA":
      return items.filter((i) => fueCargado(i) && !i.descarga);
    case "RECEPCION":
      return items.filter((i) => fueCargado(i) && !i.recepcion);
  }
}

const controlDeFase = (item: ItemControlado, fase: FaseControl) =>
  fase === "CARGA" ? item.carga : fase === "DESCARGA" ? item.descarga : item.recepcion;

function validarFase(etapa: EtapaFlete, fase: FaseControl, actor: Actor, item: ItemControlado): Resultado {
  if (FASE_DE_ETAPA[etapa] !== fase) return error("En esta etapa no se puede registrar ese control.");
  if (ACTOR_DE_FASE[fase] !== actor) return error("Ese control no te corresponde.");
  if (fase !== "CARGA" && !fueCargado(item)) return error("Ese ítem no se cargó.");
  if (controlDeFase(item, fase)?.resultado === "RECLAMO") {
    return error("Ya abriste un reclamo por ese ítem: no se puede modificar.");
  }
  return OK;
}

/** Registrar (o corregir) el control de un ítem en la fase actual. */
export function validarControl(p: {
  etapa: EtapaFlete;
  fase: FaseControl;
  actor: Actor;
  resultado: ResultadoControl;
  observacion: string | null;
  item: ItemControlado;
}): Resultado {
  const fase = validarFase(p.etapa, p.fase, p.actor, p.item);
  if (!fase.ok) return fase;
  if (!RESULTADOS_DE_FASE[p.fase].includes(p.resultado))
    return error("Ese resultado no corresponde a esta etapa.");
  if (requiereObservacion(p.resultado) && (p.observacion?.trim().length ?? 0) < LARGO_MINIMO_OBSERVACION) {
    return error(`Contá qué pasó (al menos ${LARGO_MINIMO_OBSERVACION} caracteres).`);
  }
  return OK;
}

/** Deshacer el control de un ítem (un toque de más), mientras se está en esa fase. */
export function validarQuitarControl(p: {
  etapa: EtapaFlete;
  fase: FaseControl;
  actor: Actor;
  item: ItemControlado;
}): Resultado {
  return validarFase(p.etapa, p.fase, p.actor, p.item);
}

// ---------------------------------------------------------------------------
// Transiciones
// ---------------------------------------------------------------------------

export interface ContextoTransicion {
  inventario: ResumenInventario;
  /** El actor tildó la conformidad (solo la piden ENTREGADO y CERRADO). */
  conformidad: boolean;
  motivo: string | null;
}

interface Regla {
  actores: readonly Actor[];
  /** Devuelve el motivo por el que todavía no se puede, o null. */
  condicion?: (c: ContextoTransicion) => string | null;
}

export const LARGO_MINIMO_MOTIVO = 10;

const conMotivo = (c: ContextoTransicion) =>
  (c.motivo?.trim().length ?? 0) < LARGO_MINIMO_MOTIVO
    ? `Indicá el motivo (al menos ${LARGO_MINIMO_MOTIVO} caracteres).`
    : null;

const CANCELAR: Regla = { actores: ["CLIENTE", "FLETERO"], condicion: conMotivo };

const TRANSICIONES: Record<EtapaCiclo, Partial<Record<EtapaCiclo, Regla>>> = {
  SOLICITADO: { PRESUPUESTADO: { actores: ["FLETERO"] }, CANCELADO: { actores: ["CLIENTE"] } },
  PRESUPUESTADO: { CONFIRMADO: { actores: ["CLIENTE"] }, CANCELADO: { actores: ["CLIENTE"] } },
  CONFIRMADO: { EN_CAMINO_A_ORIGEN: { actores: ["FLETERO"] }, CANCELADO: CANCELAR },
  EN_CAMINO_A_ORIGEN: { CARGANDO: { actores: ["FLETERO"] }, CANCELADO: CANCELAR },
  CARGANDO: {
    EN_TRASLADO: {
      actores: ["FLETERO"],
      condicion: ({ inventario: i }) =>
        i.pendientesCarga > 0
          ? "Resolvé todos los ítems: marcá cada uno como cargado o no cargado."
          : i.total > 0 && i.cargados === 0
            ? "No cargaste ningún ítem. Si el flete no se puede hacer, cancelalo."
            : null,
    },
    CANCELADO: {
      actores: ["CLIENTE", "FLETERO"],
      condicion: (c) =>
        c.inventario.cargados > 0 ? "Ya hay ítems cargados: el flete no se puede cancelar." : conMotivo(c),
    },
  },
  EN_TRASLADO: { DESCARGANDO: { actores: ["FLETERO"] } },
  DESCARGANDO: {
    ENTREGADO: {
      actores: ["FLETERO"],
      condicion: ({ inventario: i, conformidad }) =>
        i.pendientesDescarga > 0
          ? "Resolvé todos los ítems cargados: entregado, con daño o faltante."
          : !conformidad
            ? "Confirmá la conformidad de entrega."
            : null,
    },
  },
  ENTREGADO: {
    CERRADO: {
      actores: ["CLIENTE"],
      condicion: ({ inventario: i, conformidad }) =>
        i.pendientesRecepcion > 0
          ? "Revisá todos los ítems: confirmá que los recibiste o abrí un reclamo."
          : !conformidad
            ? "Confirmá la conformidad de recepción."
            : null,
    },
  },
  CERRADO: {},
  CANCELADO: {},
};

export function validarTransicion(
  desde: EtapaCiclo,
  hacia: EtapaCiclo,
  actor: Actor,
  contexto: ContextoTransicion,
): Resultado {
  const regla = TRANSICIONES[desde][hacia];
  if (!regla) return error("Ese cambio de estado no es posible desde la etapa actual.");
  if (!regla.actores.includes(actor)) return error("Ese cambio de estado no te corresponde.");
  const motivo = regla.condicion?.(contexto);
  return motivo ? error(motivo) : OK;
}

/** Próxima etapa del camino feliz que mueve `actor`, o null si no le toca. */
export function siguienteEtapa(etapa: EtapaCiclo, actor: Actor): EtapaCiclo | null {
  const destinos = Object.entries(TRANSICIONES[etapa]) as [EtapaCiclo, Regla][];
  return (
    destinos.find(([hacia, regla]) => hacia !== "CANCELADO" && regla.actores.includes(actor))?.[0] ?? null
  );
}

/** Si `actor` puede cancelar en esta etapa (sin contar el motivo, que se pide al cancelar). */
export function puedeCancelar(etapa: EtapaCiclo, actor: Actor, inventario?: ResumenInventario): boolean {
  const regla = TRANSICIONES[etapa].CANCELADO;
  if (!regla?.actores.includes(actor)) return false;
  return etapa !== "CARGANDO" || (inventario?.cargados ?? 0) === 0;
}

export const esEtapaFinal = (etapa: EtapaCiclo) => Object.keys(TRANSICIONES[etapa]).length === 0;

/** Texto del botón que lleva a cada etapa: lo que el actor acaba de hacer. */
export const ACCION_HACIA: Partial<Record<EtapaCiclo, string>> = {
  EN_CAMINO_A_ORIGEN: "Salgo a buscar la carga",
  CARGANDO: "Llegué al origen",
  EN_TRASLADO: "Terminé de cargar, salgo",
  DESCARGANDO: "Llegué al destino",
  ENTREGADO: "Terminé de descargar",
  CERRADO: "Cerrar el flete",
};

// ---------------------------------------------------------------------------
// Conformidad (firma con checkbox y fecha y hora)
// ---------------------------------------------------------------------------

/** Qué etapa exige la firma de cada parte. */
export const CONFORMIDAD_DE_ETAPA: Partial<Record<EtapaFlete, Actor>> = {
  ENTREGADO: "FLETERO",
  CERRADO: "CLIENTE",
};

const plural = (n: number, singular: string, varios: string) => `${n} ${n === 1 ? singular : varios}`;

/** Lo que firma cada parte. Se guarda tal cual junto con la firma, con los números del momento. */
export function textoConformidad(actor: Actor, r: ResumenInventario): string {
  const cargados = plural(r.cargados, "ítem cargado", "ítems cargados");
  if (actor === "FLETERO") {
    return (
      `Declaro que entregué la carga según este inventario: de ${cargados}, ` +
      `${plural(r.entregados, "entregado", "entregados")} en buen estado, ` +
      `${plural(r.conDano, "con daño", "con daño")} y ${plural(r.faltantes, "faltante", "faltantes")}.`
    );
  }
  return (
    `Declaro que recibí la carga: de ${cargados}, ` +
    `${plural(r.conformes, "recibido conforme", "recibidos conformes")} y ` +
    `${plural(r.reclamos, "con reclamo", "con reclamo")}.`
  );
}

// ---------------------------------------------------------------------------
// Línea de tiempo
// ---------------------------------------------------------------------------

export type EstadoPaso = "hecho" | "actual" | "pendiente" | "cancelado";

export interface PasoCiclo {
  etapa: EtapaCiclo;
  estado: EstadoPaso;
  /** Cuándo se llegó a la etapa (null si todavía no). */
  fecha: Date | null;
}

/**
 * Pasos de la línea de tiempo. En el camino feliz se muestran todos (los futuros como
 * pendientes); si se canceló, solo los que se alcanzaron y la cancelación al final.
 */
export function pasosDelCiclo(
  actual: EtapaCiclo,
  fechas: Partial<Record<EtapaCiclo, Date>>,
  recorrido: readonly EtapaCiclo[] = RECORRIDO,
): PasoCiclo[] {
  const fecha = (e: EtapaCiclo) => fechas[e] ?? null;
  if (actual === "CANCELADO") {
    return [
      ...recorrido
        .filter((e) => fechas[e])
        .map((e) => ({ etapa: e, estado: "hecho" as const, fecha: fecha(e) })),
      { etapa: "CANCELADO", estado: "cancelado", fecha: fecha("CANCELADO") },
    ];
  }
  const indice = recorrido.indexOf(actual);
  return recorrido.map((e, i) => ({
    etapa: e,
    estado: i < indice || (i === indice && esEtapaFinal(e)) ? "hecho" : i === indice ? "actual" : "pendiente",
    fecha: i <= indice ? fecha(e) : null,
  }));
}
