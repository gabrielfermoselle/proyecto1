import { describe, expect, it } from "vitest";
import { estadoPedido, etiquetaEstadoPedido, pasosPedido, pedidoEnCurso } from "./pedido";

const estados = (e: ReturnType<typeof estadoPedido>) => pasosPedido(e).map((p) => p.estado);

describe("estadoPedido", () => {
  it("sin flete, una solicitud abierta está esperando presupuestos", () => {
    const e = estadoPedido({ solicitudEstado: "ABIERTA", fleteEtapa: null });
    expect(e).toEqual({ paso: "ESPERANDO", interrupcion: null, completo: false });
    expect(estados(e)).toEqual(["actual", "pendiente", "pendiente", "pendiente"]);
    expect(pedidoEnCurso(e)).toBe(true);
  });

  it("agrupa las etapas del viaje en «En camino»", () => {
    for (const etapa of ["EN_CAMINO_A_ORIGEN", "CARGANDO", "EN_TRASLADO", "DESCARGANDO"] as const) {
      expect(estadoPedido({ solicitudEstado: "ADJUDICADA", fleteEtapa: etapa }).paso).toBe("EN_CAMINO");
    }
  });

  it("entregado espera la revisión del cliente; cerrado completa todos los pasos", () => {
    const entregado = estadoPedido({ solicitudEstado: "ADJUDICADA", fleteEtapa: "ENTREGADO" });
    expect(estados(entregado)).toEqual(["hecho", "hecho", "hecho", "actual"]);
    const cerrado = estadoPedido({ solicitudEstado: "ADJUDICADA", fleteEtapa: "CERRADO" });
    expect(estados(cerrado)).toEqual(["hecho", "hecho", "hecho", "hecho"]);
    expect(pedidoEnCurso(cerrado)).toBe(false);
  });

  it("marca dónde se cortó un pedido cancelado o vencido", () => {
    const cancelada = estadoPedido({ solicitudEstado: "CANCELADA", fleteEtapa: null });
    expect(estados(cancelada)).toEqual(["cancelado", "pendiente", "pendiente", "pendiente"]);
    expect(etiquetaEstadoPedido(cancelada)).toBe("Cancelado");
    const vencida = estadoPedido({ solicitudEstado: "VENCIDA", fleteEtapa: null });
    expect(etiquetaEstadoPedido(vencida)).toBe("Vencido");
    const fleteCancelado = estadoPedido({ solicitudEstado: "ADJUDICADA", fleteEtapa: "CANCELADO" });
    expect(estados(fleteCancelado)).toEqual(["hecho", "cancelado", "pendiente", "pendiente"]);
    expect(pedidoEnCurso(fleteCancelado)).toBe(false);
  });
});
