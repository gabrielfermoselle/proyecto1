// Fechas "de calendario" en Tucumán. Argentina usa UTC−3 todo el año (sin horario de verano),
// así que alcanza con un offset fijo. Las columnas `@db.Date` llegan como medianoche UTC.

const OFFSET_AR_MS = -3 * 60 * 60 * 1000;
const DIA_MS = 24 * 60 * 60 * 1000;

/** Fecha ISO (YYYY-MM-DD) en Tucumán del instante dado. */
export function fechaIsoAr(instante: Date = new Date()): string {
  return new Date(instante.getTime() + OFFSET_AR_MS).toISOString().slice(0, 10);
}

/** Fecha ISO de una columna `@db.Date` (medianoche UTC). */
export function fechaIsoDeDia(dia: Date): string {
  return dia.toISOString().slice(0, 10);
}

/** Medianoche UTC del día ISO, para comparar o guardar en columnas `@db.Date`. */
export function diaDesdeIso(fechaIso: string): Date {
  const dia = new Date(`${fechaIso}T00:00:00.000Z`);
  if (Number.isNaN(dia.getTime())) throw new RangeError(`Fecha inválida: ${fechaIso}`);
  return dia;
}

/** Último instante del día ISO en Tucumán (23:59:59.999 −03:00). */
export function finDelDiaAr(fechaIso: string): Date {
  return new Date(diaDesdeIso(fechaIso).getTime() + DIA_MS - 1 - OFFSET_AR_MS);
}

export function sumarDias(fechaIso: string, dias: number): string {
  return new Date(diaDesdeIso(fechaIso).getTime() + dias * DIA_MS).toISOString().slice(0, 10);
}

/** Clave de mes (YYYY-MM) en Tucumán. */
export function mesAr(instante: Date): string {
  return fechaIsoAr(instante).slice(0, 7);
}

/** Lunes de la semana del día ISO. */
export function inicioDeSemana(fechaIso: string): string {
  const diaSemana = diaDesdeIso(fechaIso).getUTCDay(); // 0 = domingo
  return sumarDias(fechaIso, -((diaSemana + 6) % 7));
}
