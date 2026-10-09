// El pedido visto por el cliente y el fletero: la solicitud y, cuando se acepta un presupuesto,
// su flete. La barra de estado lo resume en cuatro pasos; el seguimiento detallado sigue
// siendo el de `ciclo-flete`.

import type { EtapaFlete } from "./catalogos";
import type { EstadoPaso } from "./ciclo-flete";

export const PASOS_PEDIDO = ["ESPERANDO", "ACEPTADO", "EN_CAMINO", "FINALIZADO"] as const;
export type PasoPedido = (typeof PASOS_PEDIDO)[number];

export const ETIQUETA_PASO_PEDIDO: Record<PasoPedido, string> = {
  ESPERANDO: "Esperando",
  ACEPTADO: "Aceptado",
  EN_CAMINO: "En camino",
  FINALIZADO: "Finalizado",
};

const PASO_DE_ETAPA: Record<EtapaFlete, PasoPedido> = {
  CONFIRMADO: "ACEPTADO",
  EN_CAMINO_A_ORIGEN: "EN_CAMINO",
  CARGANDO: "EN_CAMINO",
  EN_TRASLADO: "EN_CAMINO",
  DESCARGANDO: "EN_CAMINO",
  ENTREGADO: "FINALIZADO",
  CERRADO: "FINALIZADO",
  // Sin el historial no se sabe hasta dónde llegó: se corta donde empieza el flete.
  CANCELADO: "ACEPTADO",
};

export type EstadoSolicitudPedido = "ABIERTA" | "ADJUDICADA" | "CANCELADA" | "VENCIDA";

export interface EstadoPedido {
  paso: PasoPedido;
  /** El pedido se cortó en `paso`. */
  interrupcion: "CANCELADO" | "VENCIDO" | null;
  /** Llegó al final y no queda nada por hacer (flete cerrado). */
  completo: boolean;
}

export function estadoPedido(d: {
  solicitudEstado: EstadoSolicitudPedido;
  fleteEtapa: EtapaFlete | null;
}): EstadoPedido {
  if (d.fleteEtapa) {
    return {
      paso: PASO_DE_ETAPA[d.fleteEtapa],
      interrupcion: d.fleteEtapa === "CANCELADO" ? "CANCELADO" : null,
      completo: d.fleteEtapa === "CERRADO",
    };
  }
  const interrupcion =
    d.solicitudEstado === "CANCELADA" ? "CANCELADO" : d.solicitudEstado === "VENCIDA" ? "VENCIDO" : null;
  return {
    paso: d.solicitudEstado === "ADJUDICADA" ? "ACEPTADO" : "ESPERANDO",
    interrupcion,
    completo: false,
  };
}

export interface PasoBarraPedido {
  clave: PasoPedido;
  titulo: string;
  estado: EstadoPaso;
}

/** Los cuatro pasos de la barra con su estado. Si se cortó, los siguientes quedan pendientes. */
export function pasosPedido(e: EstadoPedido): PasoBarraPedido[] {
  const actual = PASOS_PEDIDO.indexOf(e.paso);
  return PASOS_PEDIDO.map((clave, i) => ({
    clave,
    titulo: ETIQUETA_PASO_PEDIDO[clave],
    estado:
      i < actual || (i === actual && e.completo)
        ? "hecho"
        : i === actual
          ? e.interrupcion
            ? "cancelado"
            : "actual"
          : "pendiente",
  }));
}

/** Texto del estado para listas y badges. */
export function etiquetaEstadoPedido(e: EstadoPedido): string {
  if (e.interrupcion === "CANCELADO") return "Cancelado";
  if (e.interrupcion === "VENCIDO") return "Vencido";
  return ETIQUETA_PASO_PEDIDO[e.paso];
}

/** Sigue en curso: el cliente todavía tiene algo que mirar o hacer. */
export const pedidoEnCurso = (e: EstadoPedido) => e.interrupcion === null && !e.completo;
