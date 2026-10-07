// Agenda del fletero: conflictos de horario entre fletes del mismo día.

import { FRANJAS_HORARIAS, type FranjaHoraria } from "./catalogos";

export interface Turno {
  /** Fecha ISO (YYYY-MM-DD). */
  fecha: string;
  franja: FranjaHoraria;
}

/** Las franjas fijas no se pisan entre sí (12 h es el límite exacto); FLEXIBLE choca con todas. */
export function franjasSeSuperponen(a: FranjaHoraria, b: FranjaHoraria): boolean {
  return a === "FLEXIBLE" || b === "FLEXIBLE" || a === b;
}

export function hayConflicto(a: Turno, b: Turno): boolean {
  return a.fecha === b.fecha && franjasSeSuperponen(a.franja, b.franja);
}

/** IDs de los turnos que chocan con al menos otro. */
export function idsEnConflicto(turnos: readonly (Turno & { id: string })[]): Set<string> {
  const ids = new Set<string>();
  turnos.forEach((a, i) => {
    for (const b of turnos.slice(i + 1)) {
      if (hayConflicto(a, b)) {
        ids.add(a.id);
        ids.add(b.id);
      }
    }
  });
  return ids;
}

/** Turnos de la lista que chocan con uno nuevo (para avisar antes de presupuestar). */
export function conflictosCon<T extends Turno>(nuevo: Turno, turnos: readonly T[]): T[] {
  return turnos.filter((t) => hayConflicto(nuevo, t));
}

const ordenFranja = (f: FranjaHoraria) => FRANJAS_HORARIAS.indexOf(f);

export function ordenarTurnos<T extends Turno>(turnos: readonly T[]): T[] {
  return [...turnos].sort(
    (a, b) => a.fecha.localeCompare(b.fecha) || ordenFranja(a.franja) - ordenFranja(b.franja),
  );
}

export function agruparPorDia<T extends Turno>(turnos: readonly T[]): { fecha: string; turnos: T[] }[] {
  const grupos = new Map<string, T[]>();
  for (const turno of ordenarTurnos(turnos)) {
    const grupo = grupos.get(turno.fecha);
    if (grupo) grupo.push(turno);
    else grupos.set(turno.fecha, [turno]);
  }
  return [...grupos].map(([fecha, lista]) => ({ fecha, turnos: lista }));
}
