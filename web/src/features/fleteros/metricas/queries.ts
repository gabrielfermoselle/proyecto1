import "server-only";
import { ordenarTurnos } from "@/domain/agenda";
import type { EstadoPresupuesto, EtapaFlete } from "@/domain/catalogos";
import { fechaIsoAr } from "@/domain/fechas";
import { calcularMetricas } from "@/domain/metricas";
import { getAgenda } from "@/features/fleteros/fletes/queries";
import { consultaConteosFeed } from "@/features/fleteros/solicitudes/consultas-sql";
import { consulta, db, fallar, numero } from "@/lib/db";

export async function getPanelFletero(fleteroId: string) {
  const hoy = fechaIsoAr();
  const conteosSql = consultaConteosFeed({ fleteroId, hoy });
  const [fletes, presupuestos, perfil, agenda, conteos] = await Promise.all([
    (async () => {
      const { data, error } = await db()
        .from("fletes")
        .select("etapa, precioAcordado, recepcionConfirmadaEn")
        .eq("fleteroId", fleteroId);
      fallar(error);
      return (data ?? []) as { etapa: string; precioAcordado: number | string; recepcionConfirmadaEn: string | null }[];
    })(),
    (async () => {
      const { data, error } = await db().from("presupuestos").select("estado").eq("fleteroId", fleteroId);
      fallar(error);
      return (data ?? []) as { estado: string }[];
    })(),
    (async () => {
      const { data, error } = await db()
        .from("perfiles_fletero")
        .select("ratingPromedio, cantidadCalificaciones, disponible")
        .eq("id", fleteroId)
        .single();
      fallar(error);
      if (!data) throw new Error("No se encontró el registro");
      return data as { ratingPromedio: number | string; cantidadCalificaciones: number; disponible: boolean };
    })(),
    getAgenda(fleteroId),
    consulta<{ nuevas: number }>(conteosSql.sql, conteosSql.params),
  ]);

  const metricas = calcularMetricas(
    fletes.map((f) => ({
      etapa: f.etapa as EtapaFlete,
      precioAcordado: numero(f.precioAcordado),
      completadoEn: f.recepcionConfirmadaEn ? new Date(f.recepcionConfirmadaEn) : null,
    })),
    presupuestos.map((p) => p.estado as EstadoPresupuesto),
  );

  return {
    metricas,
    rating: numero(perfil.ratingPromedio),
    cantidadCalificaciones: perfil.cantidadCalificaciones,
    disponible: perfil.disponible,
    solicitudesNuevas: numero(conteos[0]?.nuevas ?? 0),
    proximos: ordenarTurnos(agenda.turnos.filter((t) => t.fecha >= hoy)).slice(0, 3),
    enConflicto: agenda.enConflicto,
  };
}
