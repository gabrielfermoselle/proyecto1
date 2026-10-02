"use server";

import { revalidatePath } from "next/cache";
import { resumirCarga } from "@/domain/carga";
import { fechaIsoAr, diaDesdeIso } from "@/domain/fechas";
import { haversineKm, redondear } from "@/domain/geo";
import {
  esSolicitudEditable,
  fechaPermitida,
  MAXIMO_FOTOS_SOLICITUD,
  trayectoValido,
} from "@/domain/solicitud";
import { conEventos } from "@/features/chat/eventos";
import {
  BUCKET_PRIVADO,
  eliminarArchivos,
  prepararSubida,
  rutaSubidaValida,
} from "@/features/uploads/storage";
import { ActionError, createClienteAction } from "@/lib/action";
import { consumirLimite, LIMITES } from "@/lib/limite-tasa";
import { prisma } from "@/lib/prisma";
import { configPublicaSupabase } from "@/lib/supabase";
import {
  agregarFotoSolicitudSchema,
  cancelarSolicitudSchema,
  prepararFotoSolicitudSchema,
  quitarFotoSolicitudSchema,
  solicitudSchema,
} from "./schemas";

const NO_ENCONTRADA = "No encontramos esa solicitud.";

function refrescar(solicitudId?: string) {
  revalidatePath("/cliente/solicitudes");
  if (solicitudId) revalidatePath(`/cliente/solicitudes/${solicitudId}`);
}

/**
 * Publica una solicitud. Los totales de la carga y la distancia se calculan en el servidor
 * (domain/carga y domain/geo): el feed de los fleteros y el precio sugerido dependen de ellos.
 */
export const crearSolicitud = createClienteAction({
  schema: solicitudSchema,
  handler: async (d, { clienteId, usuario }) => {
    if (!fechaPermitida(d.fecha, fechaIsoAr())) {
      throw new ActionError("Elegí un día entre hoy y los próximos 60 días.", {
        fecha: ["Elegí un día entre hoy y los próximos 60 días."],
      });
    }
    const origen = { lat: d.origenLat, lng: d.origenLng };
    const destino = { lat: d.destinoLat, lng: d.destinoLng };
    if (!trayectoValido(origen, destino)) {
      throw new ActionError("El origen y el destino son el mismo lugar.", {
        destinoDireccion: ["El destino tiene que ser distinto del origen."],
      });
    }
    await consumirLimite(LIMITES.solicitudes(usuario.id));

    const carga = resumirCarga(d.items);
    const { items, fecha, ...resto } = d;
    const solicitud = await prisma.solicitud.create({
      data: {
        ...resto,
        clienteId,
        fecha: diaDesdeIso(fecha),
        distanciaKm: redondear(haversineKm(origen, destino), 2),
        pesoTotalKg: carga.pesoTotalKg,
        volumenTotalM3: carga.volumenTotalM3,
        itemsSinMedidas: carga.itemsSinMedidas,
        items: { create: items.map((item, orden) => ({ ...item, orden })) },
      },
      select: { id: true },
    });
    refrescar();
    return { id: solicitud.id };
  },
});

/**
 * Cancela una solicitud abierta. Los presupuestos pendientes quedan rechazados y cada fletero
 * que había presupuestado recibe el aviso en su chat (que queda cerrado).
 */
export const cancelarSolicitud = createClienteAction({
  schema: cancelarSolicitudSchema,
  handler: async ({ solicitudId }, { clienteId }) => {
    await conEventos(async (tx, { emitir }) => {
      // Bloquea la solicitud: no puede aceptarse un presupuesto mientras se cancela.
      const [solicitud] = await tx.$queryRaw<{ id: string }[]>`
        SELECT id FROM solicitudes
        WHERE id = ${solicitudId} AND "clienteId" = ${clienteId} AND estado = 'ABIERTA'
        FOR UPDATE`;
      if (!solicitud) throw new ActionError("Esta solicitud ya no se puede cancelar.");

      const pendientes = await tx.presupuesto.findMany({
        where: { solicitudId, estado: "PENDIENTE" },
        select: { fleteroId: true },
      });
      await tx.presupuesto.updateMany({
        where: { solicitudId, estado: "PENDIENTE" },
        data: { estado: "RECHAZADO" },
      });
      await tx.solicitud.update({ where: { id: solicitudId }, data: { estado: "CANCELADA" } });
      for (const { fleteroId } of pendientes) {
        await emitir({ solicitudId, fleteroId, evento: "SOLICITUD_CANCELADA", datos: {} });
      }
    });
    refrescar(solicitudId);
    revalidatePath("/fletero", "layout");
    return null;
  },
});

// --- Fotos de la solicitud (bucket privado: las ven el cliente y los fleteros con acceso) ---

const carpetaFotos = (solicitudId: string) => `solicitudes/${solicitudId}`;

async function solicitudEditable(solicitudId: string, clienteId: string) {
  const solicitud = await prisma.solicitud.findFirst({
    where: { id: solicitudId, clienteId },
    select: {
      estado: true,
      items: { select: { id: true } },
      _count: { select: { fotos: true } },
    },
  });
  if (!solicitud) throw new ActionError(NO_ENCONTRADA);
  if (!esSolicitudEditable(solicitud.estado)) {
    throw new ActionError("Las fotos se pueden cambiar mientras la solicitud está abierta.");
  }
  const fotosDeItems = await prisma.foto.count({ where: { item: { solicitudId } } });
  return { itemIds: solicitud.items.map((i) => i.id), fotos: solicitud._count.fotos + fotosDeItems };
}

export const prepararFotoSolicitud = createClienteAction({
  schema: prepararFotoSolicitudSchema,
  handler: async ({ solicitudId }, { clienteId, usuario }) => {
    const { fotos } = await solicitudEditable(solicitudId, clienteId);
    if (fotos >= MAXIMO_FOTOS_SOLICITUD)
      throw new ActionError(`Podés subir hasta ${MAXIMO_FOTOS_SOLICITUD} fotos.`);
    await consumirLimite(LIMITES.imagenes(usuario.id));
    const subida = await prepararSubida(BUCKET_PRIVADO, carpetaFotos(solicitudId));
    const storage = configPublicaSupabase();
    if (!subida || !storage) throw new ActionError("La carga de fotos todavía no está habilitada.");
    return { subida, storage };
  },
});

export const agregarFotoSolicitud = createClienteAction({
  schema: agregarFotoSolicitudSchema,
  handler: async ({ solicitudId, itemId, ruta, ancho, alto }, { clienteId }) => {
    const { itemIds, fotos } = await solicitudEditable(solicitudId, clienteId);
    if (fotos >= MAXIMO_FOTOS_SOLICITUD)
      throw new ActionError(`Podés subir hasta ${MAXIMO_FOTOS_SOLICITUD} fotos.`);
    if (itemId && !itemIds.includes(itemId)) throw new ActionError("Ese ítem no es de esta solicitud.");
    if (!(await rutaSubidaValida(BUCKET_PRIVADO, ruta, carpetaFotos(solicitudId)))) {
      throw new ActionError("No pudimos verificar la foto. Probá de nuevo.");
    }
    await prisma.foto.create({
      // Una foto tiene un solo dueño (CHECK en la base): el ítem o la solicitud.
      data: { ruta, ancho, alto, ...(itemId ? { itemId } : { solicitudId }) },
    });
    refrescar(solicitudId);
    return null;
  },
});

export const quitarFotoSolicitud = createClienteAction({
  schema: quitarFotoSolicitudSchema,
  handler: async ({ fotoId }, { clienteId }) => {
    const foto = await prisma.foto.findFirst({
      where: {
        id: fotoId,
        OR: [
          { solicitud: { clienteId, estado: "ABIERTA" } },
          { item: { solicitud: { clienteId, estado: "ABIERTA" } } },
        ],
      },
      select: { id: true, ruta: true, solicitudId: true, item: { select: { solicitudId: true } } },
    });
    if (!foto) throw new ActionError("Esa foto ya no se puede quitar.");
    await prisma.foto.delete({ where: { id: foto.id } });
    await eliminarArchivos(BUCKET_PRIVADO, [foto.ruta]);
    refrescar(foto.solicitudId ?? foto.item?.solicitudId);
    return null;
  },
});
