// Ciclo de vida de un flete y quién puede mover cada etapa.
//
//   CONFIRMADO → CARGADO → EN_TRANSITO → ENTREGADO → COMPLETADO
//        └──────→ CANCELADO
//
// Control de la carga: no se pasa a CARGADO sin todos los ítems cargados, ni a ENTREGADO
// sin todos descargados. COMPLETADO lo confirma el cliente (habilita la calificación).

import type { EtapaFlete } from "./catalogos";

export type Actor = "CLIENTE" | "FLETERO";

const TRANSICIONES: Record<EtapaFlete, Partial<Record<EtapaFlete, readonly Actor[]>>> = {
  CONFIRMADO: { CARGADO: ["FLETERO"], CANCELADO: ["CLIENTE", "FLETERO"] },
  CARGADO: { EN_TRANSITO: ["FLETERO"] },
  EN_TRANSITO: { ENTREGADO: ["FLETERO"] },
  ENTREGADO: { COMPLETADO: ["CLIENTE"] },
  COMPLETADO: {},
  CANCELADO: {},
};

export interface EstadoInventario {
  total: number;
  cargados: number;
  descargados: number;
}

export type ResultadoTransicion = { ok: true } | { ok: false; motivo: string };

export function validarTransicion(
  desde: EtapaFlete,
  hacia: EtapaFlete,
  actor: Actor,
  inventario: EstadoInventario,
): ResultadoTransicion {
  const permitidos = TRANSICIONES[desde][hacia];
  if (!permitidos) return { ok: false, motivo: "Ese cambio de estado no es posible desde la etapa actual." };
  if (!permitidos.includes(actor)) return { ok: false, motivo: "Ese cambio de estado no te corresponde." };
  if (hacia === "CARGADO" && inventario.cargados < inventario.total) {
    return { ok: false, motivo: "Marcá todos los ítems como cargados antes de continuar." };
  }
  if (hacia === "ENTREGADO" && inventario.descargados < inventario.total) {
    return { ok: false, motivo: "Marcá todos los ítems como descargados antes de continuar." };
  }
  return { ok: true };
}

/** Próxima etapa que avanza el fletero (la de su botón principal), o null si no le toca. */
export function siguienteEtapaFletero(etapa: EtapaFlete): EtapaFlete | null {
  const destinos = Object.entries(TRANSICIONES[etapa]) as [EtapaFlete, readonly Actor[]][];
  return (
    destinos.find(([hacia, actores]) => hacia !== "CANCELADO" && actores.includes("FLETERO"))?.[0] ?? null
  );
}

export function puedeCancelar(etapa: EtapaFlete, actor: Actor): boolean {
  return TRANSICIONES[etapa].CANCELADO?.includes(actor) ?? false;
}

/** Fase del inventario que se registra en cada etapa (o null si no se marca nada). */
export function faseInventario(etapa: EtapaFlete): "carga" | "descarga" | null {
  if (etapa === "CONFIRMADO") return "carga";
  if (etapa === "EN_TRANSITO") return "descarga";
  return null;
}

export const ETAPAS_ACTIVAS = [
  "CONFIRMADO",
  "CARGADO",
  "EN_TRANSITO",
  "ENTREGADO",
] as const satisfies readonly EtapaFlete[];

/** Texto del botón principal: lo que el fletero acaba de hacer. */
export const ACCION_FLETERO: Partial<Record<EtapaFlete, string>> = {
  CARGADO: "Terminé de cargar",
  EN_TRANSITO: "Salgo hacia el destino",
  ENTREGADO: "Terminé de descargar",
};
