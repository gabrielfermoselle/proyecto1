import "server-only";
import type { EstadoPresupuesto, FranjaHoraria } from "@/domain/catalogos";
import { direccionAproximada } from "@/domain/direccion";
import { fechaIsoDeDia } from "@/domain/fechas";
import { db, fallar, numero, relacion } from "@/lib/db";

export const TABS_PRESUPUESTOS = ["pendientes", "aceptados", "historial"] as const;
export type TabPresupuestos = (typeof TABS_PRESUPUESTOS)[number];

const SELECT_PRESUPUESTO = `id, monto, estado, validoHasta, createdAt,
  flete:fletes!fletes_presupuestoId_fkey(id),
  solicitud:solicitudes!presupuestos_solicitudId_fkey(id, titulo, fecha, franja, origenDireccion, destinoDireccion)`;

interface FilaPresupuesto {
  id: string;
  monto: number | string;
  estado: string;
  validoHasta: string;
  createdAt: string;
  flete: { id: string } | { id: string }[] | null;
  solicitud:
    | {
        id: string;
        titulo: string;
        fecha: string;
        franja: string;
        origenDireccion: string;
        destinoDireccion: string;
      }
    | {
        id: string;
        titulo: string;
        fecha: string;
        franja: string;
        origenDireccion: string;
        destinoDireccion: string;
      }[]
    | null;
}

function listaBase(fleteroId: string) {
  return db()
    .from("presupuestos")
    .select(SELECT_PRESUPUESTO)
    .eq("fleteroId", fleteroId)
    .order("createdAt", { ascending: false })
    .limit(50);
}

function conteoBase(fleteroId: string) {
  return db().from("presupuestos").select("id", { count: "exact", head: true }).eq("fleteroId", fleteroId);
}

async function listar(fleteroId: string, tab: TabPresupuestos, ahora: string): Promise<FilaPresupuesto[]> {
  if (tab === "pendientes") {
    const { data, error } = await listaBase(fleteroId).eq("estado", "PENDIENTE").gte("validoHasta", ahora);
    fallar(error);
    return (data ?? []) as FilaPresupuesto[];
  }
  if (tab === "aceptados") {
    const { data, error } = await listaBase(fleteroId).eq("estado", "ACEPTADO");
    fallar(error);
    return (data ?? []) as FilaPresupuesto[];
  }
  const [cerrados, vencidos] = await Promise.all([
    listaBase(fleteroId).in("estado", ["RECHAZADO", "RETIRADO"]),
    listaBase(fleteroId).eq("estado", "PENDIENTE").lt("validoHasta", ahora),
  ]);
  fallar(cerrados.error);
  fallar(vencidos.error);
  return ([...(cerrados.data ?? []), ...(vencidos.data ?? [])] as FilaPresupuesto[])
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 50);
}

async function contar(fleteroId: string, tab: TabPresupuestos, ahora: string): Promise<number> {
  if (tab === "pendientes") {
    const { count, error } = await conteoBase(fleteroId).eq("estado", "PENDIENTE").gte("validoHasta", ahora);
    fallar(error);
    return count ?? 0;
  }
  if (tab === "aceptados") {
    const { count, error } = await conteoBase(fleteroId).eq("estado", "ACEPTADO");
    fallar(error);
    return count ?? 0;
  }
  const [cerrados, vencidos] = await Promise.all([
    conteoBase(fleteroId).in("estado", ["RECHAZADO", "RETIRADO"]),
    conteoBase(fleteroId).eq("estado", "PENDIENTE").lt("validoHasta", ahora),
  ]);
  fallar(cerrados.error);
  fallar(vencidos.error);
  return (cerrados.count ?? 0) + (vencidos.count ?? 0);
}

export async function getMisPresupuestos(fleteroId: string, tab: TabPresupuestos) {
  const ahora = new Date().toISOString();
  const [presupuestos, ...conteos] = await Promise.all([
    listar(fleteroId, tab, ahora),
    ...TABS_PRESUPUESTOS.map((t) => contar(fleteroId, t, ahora)),
  ]);

  return {
    presupuestos: presupuestos.map((p) => {
      const solicitud = relacion(p.solicitud);
      if (!solicitud) throw new Error("No se encontró el registro");
      const flete = relacion(p.flete);
      return {
        id: p.id,
        monto: numero(p.monto),
        estado: p.estado as EstadoPresupuesto,
        validoHasta: new Date(p.validoHasta),
        enviadoEn: new Date(p.createdAt),
        fleteId: flete?.id ?? null,
        solicitudId: solicitud.id,
        titulo: solicitud.titulo,
        fecha: fechaIsoDeDia(new Date(solicitud.fecha)),
        franja: solicitud.franja as FranjaHoraria,
        // El detalle exacto solo está en el flete; acá alcanza con la zona.
        zonaOrigen: direccionAproximada(solicitud.origenDireccion),
        zonaDestino: direccionAproximada(solicitud.destinoDireccion),
      };
    }),
    conteos: Object.fromEntries(TABS_PRESUPUESTOS.map((t, i) => [t, conteos[i] ?? 0])) as Record<
      TabPresupuestos,
      number
    >,
  };
}
