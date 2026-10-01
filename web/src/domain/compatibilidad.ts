// ¿Entra la carga en el vehículo? Los totales de la carga se calculan con `carga.ts` al
// guardar la solicitud. El feed prefiltra en SQL con las mismas dos desigualdades
// (peso ≤ capacidad y volumen ≤ volumen del vehículo); este módulo es la fuente de verdad.

export interface CapacidadVehiculo {
  capacidadKg: number;
  volumenM3: number;
}

export interface CargaResumida {
  pesoTotalKg: number;
  volumenTotalM3: number;
  itemsSinMedidas: number;
}

export type ResultadoCompatibilidad =
  /** Entra, con todos los datos informados. */
  | "COMPATIBLE"
  /** Lo informado entra, pero hay ítems sin medidas o sin peso: hay que confirmarlo con el cliente. */
  | "SIN_DATOS"
  | "EXCEDE_PESO"
  | "EXCEDE_VOLUMEN";

export function evaluarCompatibilidad(
  carga: CargaResumida,
  vehiculo: CapacidadVehiculo,
): ResultadoCompatibilidad {
  if (carga.pesoTotalKg > vehiculo.capacidadKg) return "EXCEDE_PESO";
  if (carga.volumenTotalM3 > vehiculo.volumenM3) return "EXCEDE_VOLUMEN";
  return carga.itemsSinMedidas > 0 ? "SIN_DATOS" : "COMPATIBLE";
}

/** El fletero puede presupuestar con este resultado. */
export function puedeLlevar(resultado: ResultadoCompatibilidad): boolean {
  return resultado === "COMPATIBLE" || resultado === "SIN_DATOS";
}

const porTamanio = (a: CapacidadVehiculo, b: CapacidadVehiculo) =>
  a.volumenM3 - b.volumenM3 || a.capacidadKg - b.capacidadKg;

/**
 * Vehículo a proponer: con datos completos, el más chico que alcanza (es el más barato de
 * mover). Si faltan medidas, el más grande de los que pueden, para no quedarse corto.
 */
export function vehiculoSugerido<V extends CapacidadVehiculo>(
  carga: CargaResumida,
  vehiculos: readonly V[],
): V | null {
  const candidatos = vehiculos.filter((v) => puedeLlevar(evaluarCompatibilidad(carga, v))).sort(porTamanio);
  if (candidatos.length === 0) return null;
  return (carga.itemsSinMedidas > 0 ? candidatos.at(-1) : candidatos[0]) ?? null;
}

export const ETIQUETA_COMPATIBILIDAD: Record<ResultadoCompatibilidad, string> = {
  COMPATIBLE: "Entra",
  SIN_DATOS: "Entra lo informado; faltan medidas",
  EXCEDE_PESO: "Excede el peso que soporta",
  EXCEDE_VOLUMEN: "No entra por volumen",
};
