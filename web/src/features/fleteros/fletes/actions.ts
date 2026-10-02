"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ETAPAS_FLETE } from "@/domain/catalogos";
import { faseInventario, validarTransicion } from "@/domain/maquina-estados";
import { conEventos } from "@/features/chat/eventos";
import type { EventoChat } from "@/features/chat/eventos-catalogo";
import { ActionError, createFleteroAction } from "@/lib/action";
import { prisma } from "@/lib/prisma";

const id = z.string().min(1).max(40);

/** Etapas que el fletero avanza y el mensaje de sistema que dejan en el chat. */
const EVENTO_DE_ETAPA: Partial<
  Record<
    (typeof ETAPAS_FLETE)[number],
    Extract<EventoChat, "CARGA_REGISTRADA" | "EN_VIAJE" | "DESCARGA_REGISTRADA">
  >
> = {
  CARGADO: "CARGA_REGISTRADA",
  EN_TRANSITO: "EN_VIAJE",
  ENTREGADO: "DESCARGA_REGISTRADA",
};
const FLETE_NO_ENCONTRADO = "No encontramos ese flete.";
const CAMBIO_CONCURRENTE = "El flete cambió mientras tanto. Recargá la página para ver el estado actual.";

function refrescar(fleteId: string) {
  revalidatePath(`/fletero/fletes/${fleteId}`);
  revalidatePath("/fletero", "layout");
}

/** Flete del fletero con el estado de su inventario. Si no es suyo, error (sin revelar que existe). */
async function getFletePropio(fleteId: string, fleteroId: string) {
  const flete = await prisma.flete.findFirst({
    where: { id: fleteId, fleteroId },
    select: {
      etapa: true,
      solicitudId: true,
      solicitud: { select: { items: { select: { cargadoEn: true, descargadoEn: true } } } },
    },
  });
  if (!flete) throw new ActionError(FLETE_NO_ENCONTRADO);
  const items = flete.solicitud.items;
  return {
    etapa: flete.etapa,
    solicitudId: flete.solicitudId,
    inventario: {
      total: items.length,
      cargados: items.filter((i) => i.cargadoEn).length,
      descargados: items.filter((i) => i.descargadoEn).length,
    },
  };
}

/** Columna del inventario que se marca en la etapa actual (carga en CONFIRMADO, descarga en EN_TRANSITO). */
function columnaInventario(etapa: Parameters<typeof faseInventario>[0]) {
  const fase = faseInventario(etapa);
  if (!fase) throw new ActionError("En esta etapa no se marca el inventario.");
  return fase === "carga" ? "cargadoEn" : "descargadoEn";
}

export const marcarItem = createFleteroAction({
  schema: z.object({ fleteId: id, itemId: id, marcado: z.boolean() }),
  handler: async ({ fleteId, itemId, marcado }, { fleteroId }) => {
    const { etapa } = await getFletePropio(fleteId, fleteroId);
    const columna = columnaInventario(etapa);
    const { count } = await prisma.itemInventario.updateMany({
      // El ítem tiene que pertenecer a ESTE flete, que es de ESTE fletero.
      where: { id: itemId, solicitud: { flete: { id: fleteId, fleteroId, etapa } } },
      data: { [columna]: marcado ? new Date() : null },
    });
    if (count === 0) throw new ActionError(CAMBIO_CONCURRENTE);
    refrescar(fleteId);
    return null;
  },
});

export const marcarTodos = createFleteroAction({
  schema: z.object({ fleteId: id }),
  handler: async ({ fleteId }, { fleteroId }) => {
    const { etapa } = await getFletePropio(fleteId, fleteroId);
    const columna = columnaInventario(etapa);
    await prisma.itemInventario.updateMany({
      where: { solicitud: { flete: { id: fleteId, fleteroId, etapa } }, [columna]: null },
      data: { [columna]: new Date() },
    });
    refrescar(fleteId);
    return null;
  },
});

export const avanzarEtapa = createFleteroAction({
  schema: z.object({ fleteId: id, hacia: z.enum(ETAPAS_FLETE) }),
  handler: async ({ fleteId, hacia }, { fleteroId, usuario }) => {
    const { etapa, inventario, solicitudId } = await getFletePropio(fleteId, fleteroId);
    if (hacia === "CANCELADO") throw new ActionError("Para cancelar, indicá el motivo.");
    const validacion = validarTransicion(etapa, hacia, "FLETERO", inventario);
    if (!validacion.ok) throw new ActionError(validacion.motivo);

    await conEventos(async (tx, { emitir }) => {
      // Lock optimista: solo avanza si nadie cambió la etapa desde que la leímos.
      const { count } = await tx.flete.updateMany({
        where: { id: fleteId, fleteroId, etapa },
        data: { etapa: hacia },
      });
      if (count === 0) throw new ActionError(CAMBIO_CONCURRENTE);
      await tx.estadoFlete.create({ data: { fleteId, etapa: hacia, autorId: usuario.id } });
      const evento = EVENTO_DE_ETAPA[hacia];
      if (evento) await emitir({ solicitudId, fleteroId, evento, datos: {} });
    });
    refrescar(fleteId);
    return { etapa: hacia };
  },
});

export const cancelarFlete = createFleteroAction({
  schema: z.object({
    fleteId: id,
    motivo: z
      .string()
      .trim()
      .min(10, "Contale al cliente por qué cancelás (al menos 10 caracteres)")
      .max(300),
  }),
  handler: async ({ fleteId, motivo }, { fleteroId, usuario }) => {
    const { etapa, inventario, solicitudId } = await getFletePropio(fleteId, fleteroId);
    const validacion = validarTransicion(etapa, "CANCELADO", "FLETERO", inventario);
    if (!validacion.ok) throw new ActionError("Solo se puede cancelar antes de cargar.");

    await conEventos(async (tx, { emitir }) => {
      const { count } = await tx.flete.updateMany({
        where: { id: fleteId, fleteroId, etapa },
        data: { etapa: "CANCELADO" },
      });
      if (count === 0) throw new ActionError(CAMBIO_CONCURRENTE);
      await tx.estadoFlete.create({
        data: { fleteId, etapa: "CANCELADO", autorId: usuario.id, nota: motivo },
      });
      // La solicitud queda cancelada: el cliente la puede volver a publicar.
      await tx.solicitud.update({ where: { id: solicitudId }, data: { estado: "CANCELADA" } });
      // Bloquea el chat del par y le avisa al cliente con el motivo.
      await emitir({ solicitudId, fleteroId, evento: "FLETE_CANCELADO", datos: { motivo, por: "FLETERO" } });
    });
    refrescar(fleteId);
    return null;
  },
});
