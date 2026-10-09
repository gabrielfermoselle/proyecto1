import "server-only";
import { fechaIsoAr } from "@/domain/fechas";
import { hrefPedido } from "@/features/fletes/rutas";
import { eliminarArchivos, type Bucket } from "@/features/uploads/storage";
import { ahoraIso, db, fallar, nuevoId, relacion } from "@/lib/db";
import { limpiarVentanasViejas } from "@/lib/limite-tasa-sql";
import { publicar, type Publicacion } from "@/lib/supabase";

// Tareas diarias (las dispara el cron de /api/cron/mantenimiento). Cada una es idempotente:
// correrla dos veces el mismo día no duplica avisos ni falla.

const HORA_MS = 60 * 60 * 1000;
/** Una subida firmada que no se adjuntó en un día ya no se va a adjuntar. */
const ANTIGUEDAD_SUBIDA_ABANDONADA_MS = 24 * HORA_MS;

const ETAPAS_SIN_EMPEZAR = ["CONFIRMADO", "EN_CAMINO_A_ORIGEN"] as const;

function uno<T>(valor: T | T[] | null | undefined): T {
  const fila = relacion(valor);
  if (!fila) throw new Error("Falta un dato relacionado");
  return fila;
}

interface AvisoNuevo {
  userId: string;
  tipo: "PRESUPUESTO" | "FLETE";
  titulo: string;
  cuerpo: string;
  href: string;
  clave: string;
}

/** Inserta avisos y se saltea los que ya existen (índice único userId + clave). Devuelve cuántos entraron. */
async function insertarAvisos(filas: AvisoNuevo[]): Promise<number> {
  if (filas.length === 0) return 0;
  const ahora = ahoraIso();
  const { data, error } = await db()
    .from("notificaciones")
    .upsert(
      filas.map((fila) => ({ id: nuevoId(), ...fila, leidaEn: null, updatedAt: ahora })),
      { onConflict: "userId,clave", ignoreDuplicates: true },
    )
    .select("id");
  fallar(error);
  return data?.length ?? 0;
}

/** Solicitudes abiertas cuyo día ya pasó sin que el cliente eligiera: pasan a VENCIDA. */
export async function vencerSolicitudes(hoy: string = fechaIsoAr()) {
  const { data, error } = await db()
    .from("solicitudes")
    .select("id, titulo, perfiles_cliente(userId)")
    .eq("estado", "ABIERTA")
    .lt("fecha", `${hoy}T00:00:00.000Z`);
  fallar(error);
  const vencidas = (data ?? []) as {
    id: string;
    titulo: string;
    perfiles_cliente: { userId: string } | { userId: string }[] | null;
  }[];
  if (vencidas.length === 0) return 0;
  const { error: errorUpdate } = await db()
    .from("solicitudes")
    .update({ estado: "VENCIDA", updatedAt: ahoraIso() })
    .in(
      "id",
      vencidas.map((s) => s.id),
    )
    .eq("estado", "ABIERTA");
  fallar(errorUpdate);
  await insertarAvisos(
    vencidas.map((s) => ({
      userId: uno(s.perfiles_cliente).userId,
      tipo: "PRESUPUESTO" as const,
      titulo: "Tu solicitud venció sin elegir presupuesto",
      cuerpo: s.titulo,
      href: hrefPedido("CLIENTE", s.id),
      clave: `solicitud-vencida:${s.id}`,
    })),
  );
  await publicar(vencidas.map((s) => aviso(uno(s.perfiles_cliente).userId)));
  return vencidas.length;
}

/**
 * Fletes cuyo día ya pasó y no empezaron (siguen confirmados o en camino al origen): se avisa a
 * las dos partes una sola vez, para que lo hagan o lo cancelen. El admin los ve en su panel.
 */
export async function avisarFletesDemorados(hoy: string = fechaIsoAr()) {
  const { data, error } = await db()
    .from("fletes")
    .select(
      `id, solicitudId,
      solicitudes!inner (titulo),
      perfiles_cliente (userId),
      perfiles_fletero (userId)`,
    )
    .in("etapa", [...ETAPAS_SIN_EMPEZAR])
    .lt("solicitudes.fecha", `${hoy}T00:00:00.000Z`);
  fallar(error);
  const demorados = (data ?? []) as {
    id: string;
    solicitudId: string;
    solicitudes: { titulo: string } | { titulo: string }[] | null;
    perfiles_cliente: { userId: string } | { userId: string }[] | null;
    perfiles_fletero: { userId: string } | { userId: string }[] | null;
  }[];
  if (demorados.length === 0) return 0;
  const insertados = await insertarAvisos(
    demorados.flatMap((f) => {
      const titulo = uno(f.solicitudes).titulo;
      return [
        {
          userId: uno(f.perfiles_cliente).userId,
          tipo: "FLETE" as const,
          titulo: "Tu flete quedó sin hacer: hablalo con el fletero o cancelalo",
          cuerpo: titulo,
          href: hrefPedido("CLIENTE", f.solicitudId),
          clave: `flete-demorado:${f.id}`,
        },
        {
          userId: uno(f.perfiles_fletero).userId,
          tipo: "FLETE" as const,
          titulo: "Un flete tuyo quedó sin hacer: avanzalo o cancelalo",
          cuerpo: titulo,
          href: hrefPedido("FLETERO", f.solicitudId),
          clave: `flete-demorado:${f.id}`,
        },
      ];
    }),
  );
  // La clave única (userId, clave) hace que cada aviso salga una sola vez.
  if (insertados > 0) {
    await publicar(
      demorados.flatMap((f) => [
        aviso(uno(f.perfiles_cliente).userId),
        aviso(uno(f.perfiles_fletero).userId),
      ]),
    );
  }
  return demorados.length;
}

/** Borra los archivos de subidas firmadas que nunca se adjuntaron a una foto. */
export async function limpiarSubidasAbandonadas(ahora: Date = new Date()) {
  const { data, error } = await db()
    .from("subidas_pendientes")
    .select("ruta, bucket")
    .lt("createdAt", new Date(ahora.getTime() - ANTIGUEDAD_SUBIDA_ABANDONADA_MS).toISOString())
    .limit(500);
  fallar(error);
  const viejas = (data ?? []) as { ruta: string; bucket: string }[];
  if (viejas.length === 0) return 0;
  const rutas = viejas.map((v) => v.ruta);
  const { data: fotos, error: errorFotos } = await db().from("fotos").select("ruta").in("ruta", rutas);
  fallar(errorFotos);
  const usadas = new Set((fotos ?? []).map((f) => f.ruta as string));
  const abandonadas = viejas.filter((v) => !usadas.has(v.ruta));
  for (const bucket of new Set(abandonadas.map((a) => a.bucket))) {
    await eliminarArchivos(
      bucket as Bucket,
      abandonadas.filter((a) => a.bucket === bucket).map((a) => a.ruta),
    );
  }
  // Las usadas ya no están pendientes; las abandonadas ya se borraron.
  const { error: errorBorrado } = await db().from("subidas_pendientes").delete().in("ruta", rutas);
  fallar(errorBorrado);
  return abandonadas.length;
}

export async function limpiarLimitesDeTasa(ahora: Date = new Date()) {
  const antesDe = new Date(ahora.getTime() - 24 * HORA_MS);
  const { count, error } = await db()
    .from("limites_tasa")
    .select("*", { count: "exact", head: true })
    .lt("ventana", antesDe.toISOString());
  fallar(error);
  await limpiarVentanasViejas(antesDe);
  return count ?? 0;
}

/** Tokens de recuperación vencidos o usados hace más de un día: ya no sirven para nada. */
export async function limpiarTokensRecuperacion(ahora: Date = new Date()) {
  const limite = new Date(ahora.getTime() - 24 * HORA_MS).toISOString();
  const { data: expirados, error: errorExpira } = await db()
    .from("tokens_recuperacion")
    .delete()
    .lt("expiraEn", limite)
    .select("id");
  fallar(errorExpira);
  const { data: usados, error: errorUsados } = await db()
    .from("tokens_recuperacion")
    .delete()
    .lt("usadoEn", limite)
    .select("id");
  fallar(errorUsados);
  return (expirados?.length ?? 0) + (usados?.length ?? 0);
}

const aviso = (userId: string): Publicacion => ({
  topic: `usuario:${userId}`,
  event: "notificacion.creada",
  payload: {},
});

/** Corre todas las tareas, una después de otra (comparten la conexión a la base). */
export async function correrMantenimiento() {
  const solicitudesVencidas = await vencerSolicitudes();
  const fletesDemorados = await avisarFletesDemorados();
  const subidasBorradas = await limpiarSubidasAbandonadas();
  const limitesBorrados = await limpiarLimitesDeTasa();
  const tokensBorrados = await limpiarTokensRecuperacion();
  return { solicitudesVencidas, fletesDemorados, subidasBorradas, limitesBorrados, tokensBorrados };
}
