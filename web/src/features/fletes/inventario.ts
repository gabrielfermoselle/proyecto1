import type { FaseControl, ResultadoControl } from "@prisma/client";
import type { ControlRegistrado, ItemControlado } from "@/domain/ciclo-flete";

// De las filas de controles_item a la forma que usa el dominio (un control por fase).

interface ControlFila {
  fase: FaseControl;
  resultado: ResultadoControl;
  observacion: string | null;
}

export function controlesPorFase<C extends ControlFila>(controles: readonly C[]) {
  const de = (fase: FaseControl) => controles.find((c) => c.fase === fase) ?? null;
  return { carga: de("CARGA"), descarga: de("DESCARGA"), recepcion: de("RECEPCION") };
}

export function aItemControlado(id: string, controles: readonly ControlFila[]): ItemControlado {
  const solo = (c: ControlFila | null): ControlRegistrado | null =>
    c ? { resultado: c.resultado, observacion: c.observacion } : null;
  const { carga, descarga, recepcion } = controlesPorFase(controles);
  return { id, carga: solo(carga), descarga: solo(descarga), recepcion: solo(recepcion) };
}
