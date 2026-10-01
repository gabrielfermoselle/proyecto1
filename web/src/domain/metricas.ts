// Métricas del panel del fletero, calculadas sobre filas ya filtradas por fletero.

import type { EstadoPresupuesto, EtapaFlete } from "./catalogos";
import { mesAr } from "./fechas";

export interface FleteParaMetricas {
  etapa: EtapaFlete;
  precioAcordado: number;
  /** Cuándo el cliente confirmó la recepción (solo en COMPLETADO). */
  completadoEn: Date | null;
}

export interface Metricas {
  /** Solo cuentan los fletes que el cliente confirmó como recibidos. */
  gananciasMes: number;
  gananciasTotales: number;
  fletesCompletados: number;
  fletesEnCurso: number;
  /** aceptados / (aceptados + rechazados); null si todavía no hay presupuestos decididos. */
  tasaAceptacion: number | null;
  presupuestosDecididos: number;
  gananciasPorMes: { mes: string; total: number }[];
}

const EN_CURSO: readonly EtapaFlete[] = ["CONFIRMADO", "CARGADO", "EN_TRANSITO", "ENTREGADO"];

/** Los `cantidad` meses que terminan en el de `ahora` (inclusive), del más viejo al más nuevo. */
function ultimosMeses(ahora: Date, cantidad: number): string[] {
  const [anio, mes] = mesAr(ahora).split("-").map(Number) as [number, number];
  return Array.from({ length: cantidad }, (_, i) => {
    const fecha = new Date(Date.UTC(anio, mes - 1 - (cantidad - 1 - i), 1));
    return fecha.toISOString().slice(0, 7);
  });
}

export function calcularMetricas(
  fletes: readonly FleteParaMetricas[],
  estadosPresupuestos: readonly EstadoPresupuesto[],
  ahora: Date = new Date(),
  meses = 6,
): Metricas {
  const porMes = new Map(ultimosMeses(ahora, meses).map((m) => [m, 0]));
  const mesActual = mesAr(ahora);
  let gananciasTotales = 0;
  let fletesCompletados = 0;
  let fletesEnCurso = 0;

  for (const flete of fletes) {
    if (EN_CURSO.includes(flete.etapa)) fletesEnCurso += 1;
    if (flete.etapa !== "COMPLETADO" || !flete.completadoEn) continue;
    fletesCompletados += 1;
    gananciasTotales += flete.precioAcordado;
    const mes = mesAr(flete.completadoEn);
    const acumulado = porMes.get(mes);
    if (acumulado !== undefined) porMes.set(mes, acumulado + flete.precioAcordado);
  }

  const aceptados = estadosPresupuestos.filter((e) => e === "ACEPTADO").length;
  const rechazados = estadosPresupuestos.filter((e) => e === "RECHAZADO").length;
  const presupuestosDecididos = aceptados + rechazados;

  return {
    gananciasMes: porMes.get(mesActual) ?? 0,
    gananciasTotales,
    fletesCompletados,
    fletesEnCurso,
    tasaAceptacion: presupuestosDecididos === 0 ? null : aceptados / presupuestosDecididos,
    presupuestosDecididos,
    gananciasPorMes: [...porMes].map(([mes, total]) => ({ mes, total })),
  };
}
