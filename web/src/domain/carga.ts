// Resumen físico de la carga de una solicitud. Lo usan el wizard del cliente (para guardar
// los totales en la solicitud) y la compatibilidad con los vehículos del fletero.

export interface ItemCarga {
  cantidad: number;
  largoCm?: number | null;
  anchoCm?: number | null;
  altoCm?: number | null;
  pesoKgAprox?: number | null;
}

export interface ResumenCarga {
  /** Suma de los pesos informados (los ítems sin peso no suman). */
  pesoTotalKg: number;
  /** Volumen de los ítems con medidas, afectado por el factor de estiba. */
  volumenTotalM3: number;
  /** Ítems (no unidades) a los que les falta alguna medida o el peso. */
  itemsSinMedidas: number;
  cantidadBultos: number;
}

/** Los bultos no encajan perfecto: se reserva un 25 % de espacio extra. */
export const FACTOR_ESTIBA = 1.25;

const CM3_POR_M3 = 1_000_000;

const esPositivo = (v: number | null | undefined): v is number => typeof v === "number" && v > 0;

export function resumirCarga(items: readonly ItemCarga[]): ResumenCarga {
  let pesoTotalKg = 0;
  let volumenCm3 = 0;
  let itemsSinMedidas = 0;
  let cantidadBultos = 0;

  for (const item of items) {
    if (!Number.isInteger(item.cantidad) || item.cantidad <= 0) {
      throw new RangeError(`Cantidad inválida: ${item.cantidad}`);
    }
    cantidadBultos += item.cantidad;

    const { largoCm, anchoCm, altoCm, pesoKgAprox } = item;
    const tieneMedidas = esPositivo(largoCm) && esPositivo(anchoCm) && esPositivo(altoCm);
    if (tieneMedidas) volumenCm3 += largoCm * anchoCm * altoCm * item.cantidad;
    if (esPositivo(pesoKgAprox)) pesoTotalKg += pesoKgAprox * item.cantidad;
    if (!tieneMedidas || !esPositivo(pesoKgAprox)) itemsSinMedidas += 1;
  }

  return {
    pesoTotalKg: Math.round(pesoTotalKg * 100) / 100,
    volumenTotalM3: Math.round((volumenCm3 / CM3_POR_M3) * FACTOR_ESTIBA * 1000) / 1000,
    itemsSinMedidas,
    cantidadBultos,
  };
}
