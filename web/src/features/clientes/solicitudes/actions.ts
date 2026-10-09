"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { resumirCarga } from "@/domain/carga";
import { fechaIsoAr } from "@/domain/fechas";
import { haversineKm, redondear } from "@/domain/geo";
import {
  esSolicitudEditable,
  fechaPermitida,
  MAXIMO_FOTOS_SOLICITUD,
  trayectoValido,
} from "@/domain/solicitud";
import { conEventos } from "@/features/chat/eventos";
import { hrefPedido } from "@/features/fletes/rutas";
import {
  BUCKET_PRIVADO,
  eliminarArchivos,
  prepararSubida,
  rutaSubidaValida,
} from "@/features/uploads/storage";
import { ActionError, createClienteAction } from "@/lib/action";
import { ahoraIso, db, fallar, nuevoId, relacion } from "@/lib/db";
import { consumirLimite, LIMITES } from "@/lib/limite-tasa";
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
  revalidatePath("/cliente");
  if (solicitudId) revalidatePath(hrefPedido("CLIENTE", solicitudId));
}

function lista<T>(valor: T | T[] | null | undefined): T[] {
  if (valor == null) return [];
  return Array.isArray(valor) ? valor : [valor];
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
    const solicitudId = nuevoId();
    const { error } = await db()
      .from("solicitudes")
      .insert({
        ...resto,
        id: solicitudId,
        clienteId,
        fecha,
        distanciaKm: redondear(haversineKm(origen, destino), 2),
        pesoTotalKg: carga.pesoTotalKg,
        volumenTotalM3: carga.volumenTotalM3,
        itemsSinMedidas: carga.itemsSinMedidas,
        updatedAt: ahoraIso(),
      });
    fallar(error);

    const { error: errorItems } = await db()
      .from("items_inventario")
      .insert(items.map((item, orden) => ({ ...item, id: nuevoId(), solicitudId, orden })));
    if (errorItems) {
      await db().from("solicitudes").delete().eq("id", solicitudId);
      fallar(errorItems);
    }
    refrescar();
    return { id: solicitudId };
  },
});

/**
 * Cancela una solicitud abierta. Los presupuestos pendientes quedan rechazados y cada fletero
 * que había presupuestado recibe el aviso en su chat (que queda cerrado).
 */
export const cancelarSolicitud = createClienteAction({
  schema: cancelarSolicitudSchema,
  handler: async ({ solicitudId, motivo }, { clienteId }) => {
    await conEventos(async (tx: SupabaseClient, { emitir }) => {
      const marca = ahoraIso();
      // El update condicionado reclama la fila: si otra operación ya la cerró, no toca nada.
      const { data: reclamada, error: errorReclamo } = await tx
        .from("solicitudes")
        .update({ estado: "CANCELADA", motivoCancelacion: motivo, updatedAt: marca })
        .eq("id", solicitudId)
        .eq("clienteId", clienteId)
        .eq("estado", "ABIERTA")
        .select("id")
        .maybeSingle();
      fallar(errorReclamo);
      if (!reclamada) throw new ActionError("Esta solicitud ya no se puede cancelar.");

      const { data: pendientes, error: errorPendientes } = await tx
        .from("presupuestos")
        .select("fleteroId")
        .eq("solicitudId", solicitudId)
        .eq("estado", "PENDIENTE");
      fallar(errorPendientes);
      const { error: errorRechazo } = await tx
        .from("presupuestos")
        .update({ estado: "RECHAZADO", updatedAt: marca })
        .eq("solicitudId", solicitudId)
        .eq("estado", "PENDIENTE");
      if (errorRechazo) {
        const { error: errorReverso } = await tx
          .from("solicitudes")
          .update({ estado: "ABIERTA", motivoCancelacion: null, updatedAt: ahoraIso() })
          .eq("id", solicitudId)
          .eq("clienteId", clienteId)
          .eq("estado", "CANCELADA");
        fallar(errorReverso);
        fallar(errorRechazo);
      }
      for (const { fleteroId } of pendientes ?? []) {
        await emitir({
          solicitudId,
          fleteroId,
          evento: "SOLICITUD_CANCELADA",
          datos: motivo ? { motivo } : {},
        });
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
  const { data, error } = await db()
    .from("solicitudes")
    .select("estado, items_inventario(id), fotos(id)")
    .eq("id", solicitudId)
    .eq("clienteId", clienteId)
    .maybeSingle();
  fallar(error);
  if (!data) throw new ActionError(NO_ENCONTRADA);
  if (!esSolicitudEditable(data.estado as string)) {
    throw new ActionError("Las fotos se pueden cambiar mientras la solicitud está abierta.");
  }
  const itemIds = lista(data.items_inventario as { id: string }[] | null).map((i) => i.id);
  let fotosDeItems = 0;
  if (itemIds.length > 0) {
    const conteo = await db()
      .from("fotos")
      .select("id", { count: "exact", head: true })
      .in("itemId", itemIds);
    fallar(conteo.error);
    fotosDeItems = conteo.count ?? 0;
  }
  return { itemIds, fotos: lista(data.fotos as { id: string }[] | null).length + fotosDeItems };
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
    const { error } = await db()
      .from("fotos")
      .insert({
        id: nuevoId(),
        ruta,
        ancho,
        alto,
        // Una foto tiene un solo dueño (CHECK en la base): el ítem o la solicitud.
        ...(itemId ? { itemId } : { solicitudId }),
      });
    fallar(error);
    refrescar(solicitudId);
    return null;
  },
});

interface Dueña {
  clienteId: string;
  estado: string;
}

interface FotoQuitable {
  id: string;
  ruta: string;
  solicitudId: string | null;
  solicitudes: Dueña | Dueña[] | null;
  items_inventario:
    | { solicitudId: string; solicitudes: Dueña | Dueña[] | null }
    | { solicitudId: string; solicitudes: Dueña | Dueña[] | null }[]
    | null;
}

function abiertaDelCliente(valor: Dueña | Dueña[] | null, clienteId: string) {
  const fila = relacion(valor);
  return fila?.clienteId === clienteId && fila.estado === "ABIERTA";
}

export const quitarFotoSolicitud = createClienteAction({
  schema: quitarFotoSolicitudSchema,
  handler: async ({ fotoId }, { clienteId }) => {
    const { data, error } = await db()
      .from("fotos")
      .select(
        "id, ruta, solicitudId, solicitudes(clienteId, estado), items_inventario(solicitudId, solicitudes(clienteId, estado))",
      )
      .eq("id", fotoId)
      .maybeSingle();
    fallar(error);
    const foto = data as FotoQuitable | null;
    const item = foto ? relacion(foto.items_inventario) : null;
    const esSuya =
      foto != null &&
      (abiertaDelCliente(foto.solicitudes, clienteId) ||
        (item != null && abiertaDelCliente(item.solicitudes, clienteId)));
    if (!foto || !esSuya) throw new ActionError("Esa foto ya no se puede quitar.");
    const { error: errorBorrado } = await db().from("fotos").delete().eq("id", foto.id);
    fallar(errorBorrado);
    await eliminarArchivos(BUCKET_PRIVADO, [foto.ruta]);
    refrescar(foto.solicitudId ?? item?.solicitudId);
    return null;
  },
});
