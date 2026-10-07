import "server-only";
import { fechaIsoAr } from "@/domain/fechas";
import { hrefFlete } from "@/features/fletes/rutas";
import { eliminarArchivos, type Bucket } from "@/features/uploads/storage";
import { prisma } from "@/lib/prisma";
import { consultaLimpiar } from "@/lib/limite-tasa-sql";
import { publicar, type Publicacion } from "@/lib/supabase";

// Tareas diarias (las dispara el cron de /api/cron/mantenimiento). Cada una es idempotente:
// correrla dos veces el mismo día no duplica avisos ni falla.

const HORA_MS = 60 * 60 * 1000;
/** Una subida firmada que no se adjuntó en un día ya no se va a adjuntar. */
const ANTIGUEDAD_SUBIDA_ABANDONADA_MS = 24 * HORA_MS;

/** Solicitudes abiertas cuyo día ya pasó sin que el cliente eligiera: pasan a VENCIDA. */
export async function vencerSolicitudes(hoy: string = fechaIsoAr()) {
  const vencidas = await prisma.solicitud.findMany({
    where: { estado: "ABIERTA", fecha: { lt: new Date(`${hoy}T00:00:00.000Z`) } },
    select: { id: true, titulo: true, cliente: { select: { userId: true } } },
  });
  if (vencidas.length === 0) return 0;
  await prisma.$transaction([
    prisma.solicitud.updateMany({
      where: { id: { in: vencidas.map((s) => s.id) }, estado: "ABIERTA" },
      data: { estado: "VENCIDA" },
    }),
    prisma.notificacion.createMany({
      data: vencidas.map((s) => ({
        userId: s.cliente.userId,
        tipo: "PRESUPUESTO" as const,
        titulo: "Tu solicitud venció sin elegir presupuesto",
        cuerpo: s.titulo,
        href: `/cliente/solicitudes/${s.id}`,
        clave: `solicitud-vencida:${s.id}`,
      })),
      skipDuplicates: true,
    }),
  ]);
  await publicar(vencidas.map((s) => aviso(s.cliente.userId)));
  return vencidas.length;
}

/**
 * Fletes cuyo día ya pasó y no empezaron (siguen confirmados o en camino al origen): se avisa a
 * las dos partes una sola vez, para que lo hagan o lo cancelen. El admin los ve en su panel.
 */
export async function avisarFletesDemorados(hoy: string = fechaIsoAr()) {
  const demorados = await prisma.flete.findMany({
    where: {
      etapa: { in: ["CONFIRMADO", "EN_CAMINO_A_ORIGEN"] },
      solicitud: { fecha: { lt: new Date(`${hoy}T00:00:00.000Z`) } },
    },
    select: {
      id: true,
      solicitud: { select: { titulo: true } },
      cliente: { select: { userId: true } },
      fletero: { select: { userId: true } },
    },
  });
  if (demorados.length === 0) return 0;
  const { count } = await prisma.notificacion.createMany({
    data: demorados.flatMap((f) => [
      {
        userId: f.cliente.userId,
        tipo: "FLETE" as const,
        titulo: "Tu flete quedó sin hacer: hablalo con el fletero o cancelalo",
        cuerpo: f.solicitud.titulo,
        href: hrefFlete("CLIENTE", f.id),
        clave: `flete-demorado:${f.id}`,
      },
      {
        userId: f.fletero.userId,
        tipo: "FLETE" as const,
        titulo: "Un flete tuyo quedó sin hacer: avanzalo o cancelalo",
        cuerpo: f.solicitud.titulo,
        href: hrefFlete("FLETERO", f.id),
        clave: `flete-demorado:${f.id}`,
      },
    ]),
    // La clave única (userId, clave) hace que cada aviso salga una sola vez.
    skipDuplicates: true,
  });
  if (count > 0) await publicar(demorados.flatMap((f) => [aviso(f.cliente.userId), aviso(f.fletero.userId)]));
  return demorados.length;
}

/** Borra los archivos de subidas firmadas que nunca se adjuntaron a una foto. */
export async function limpiarSubidasAbandonadas(ahora: Date = new Date()) {
  const viejas = await prisma.subidaPendiente.findMany({
    where: { createdAt: { lt: new Date(ahora.getTime() - ANTIGUEDAD_SUBIDA_ABANDONADA_MS) } },
    select: { ruta: true, bucket: true },
    take: 500,
  });
  if (viejas.length === 0) return 0;
  const usadas = new Set(
    (
      await prisma.foto.findMany({
        where: { ruta: { in: viejas.map((v) => v.ruta) } },
        select: { ruta: true },
      })
    ).map((f) => f.ruta),
  );
  const abandonadas = viejas.filter((v) => !usadas.has(v.ruta));
  for (const bucket of new Set(abandonadas.map((a) => a.bucket))) {
    await eliminarArchivos(
      bucket as Bucket,
      abandonadas.filter((a) => a.bucket === bucket).map((a) => a.ruta),
    );
  }
  // Las usadas ya no están pendientes; las abandonadas ya se borraron.
  await prisma.subidaPendiente.deleteMany({ where: { ruta: { in: viejas.map((v) => v.ruta) } } });
  return abandonadas.length;
}

export async function limpiarLimitesDeTasa(ahora: Date = new Date()) {
  return prisma.$executeRaw(consultaLimpiar(new Date(ahora.getTime() - 24 * HORA_MS)));
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
  return { solicitudesVencidas, fletesDemorados, subidasBorradas, limitesBorrados };
}
