import "server-only";
import { idsEnConflicto } from "@/domain/agenda";
import type { EtapaFlete, FranjaHoraria, TipoFlete, TipoVehiculo } from "@/domain/catalogos";
import { ETAPAS_ACTIVAS } from "@/domain/ciclo-flete";
import { fechaIsoDeDia } from "@/domain/fechas";
import { db, fallar, numero, relacion } from "@/lib/db";

interface FilaFlete {
  id: string;
  etapa: string;
  precioAcordado: number | string;
  solicitudId: string;
  vehiculo:
    | { marca: string; modelo: string; tipo: string }
    | { marca: string; modelo: string; tipo: string }[]
    | null;
  solicitud:
    | {
        titulo: string;
        tipoFlete: string;
        fecha: string;
        franja: string;
        origenDireccion: string;
        destinoDireccion: string;
      }
    | {
        titulo: string;
        tipoFlete: string;
        fecha: string;
        franja: string;
        origenDireccion: string;
        destinoDireccion: string;
      }[]
    | null;
}

function obligatorio<T>(valor: T | T[] | null | undefined): T {
  const fila = relacion(valor);
  if (!fila) throw new Error("No se encontró el registro");
  return fila;
}

/** Fletes en curso del fletero como turnos de agenda (fecha + franja). */
export async function getTurnosActivos(fleteroId: string) {
  const { data, error } = await db()
    .from("fletes")
    .select(
      "id, etapa, precioAcordado, solicitudId, vehiculo:vehiculos!fletes_vehiculoId_fkey(marca, modelo, tipo), solicitud:solicitudes!fletes_solicitudId_fkey(titulo, tipoFlete, fecha, franja, origenDireccion, destinoDireccion)",
    )
    .eq("fleteroId", fleteroId)
    .in("etapa", [...ETAPAS_ACTIVAS]);
  fallar(error);

  return ((data ?? []) as FilaFlete[]).map((f) => {
    const solicitud = obligatorio(f.solicitud);
    const vehiculo = obligatorio(f.vehiculo);
    return {
      id: f.id,
      solicitudId: f.solicitudId,
      etapa: f.etapa as EtapaFlete,
      precioAcordado: numero(f.precioAcordado),
      titulo: solicitud.titulo,
      tipoFlete: solicitud.tipoFlete as TipoFlete,
      fecha: fechaIsoDeDia(new Date(solicitud.fecha)),
      franja: solicitud.franja as FranjaHoraria,
      origen: solicitud.origenDireccion,
      destino: solicitud.destinoDireccion,
      vehiculo: `${vehiculo.marca} ${vehiculo.modelo}`,
      tipoVehiculo: vehiculo.tipo as TipoVehiculo,
    };
  });
}

export type TurnoAgenda = Awaited<ReturnType<typeof getTurnosActivos>>[number];

export async function getAgenda(fleteroId: string) {
  const turnos = await getTurnosActivos(fleteroId);
  return { turnos, enConflicto: idsEnConflicto(turnos) };
}
