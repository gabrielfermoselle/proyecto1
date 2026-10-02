"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { validarTransicion } from "@/domain/maquina-estados";
import { conEventos } from "@/features/chat/eventos";
import { ActionError, createClienteAction } from "@/lib/action";
import { prisma } from "@/lib/prisma";

const id = z.string().min(1).max(40);

const FLETE_NO_ENCONTRADO = "No encontramos ese flete.";
const CAMBIO_CONCURRENTE = "El flete cambió mientras tanto. Recargá la página para ver el estado actual.";
// Las transiciones del cliente no dependen del inventario.
const SIN_INVENTARIO = { total: 0, cargados: 0, descargados: 0 };

/** Flete del cliente. Si no es suyo, error (sin revelar que existe). */
async function getFletePropio(fleteId: string, clienteId: string) {
  const flete = await prisma.flete.findFirst({
    where: { id: fleteId, clienteId },
    select: { etapa: true, solicitudId: true, fleteroId: true },
  });
  if (!flete) throw new ActionError(FLETE_NO_ENCONTRADO);
  return flete;
}

/** ENTREGADO → COMPLETADO: el cliente recibió todo. Habilita la calificación. */
export const confirmarRecepcion = createClienteAction({
  schema: z.object({ fleteId: id }),
  handler: async ({ fleteId }, { clienteId, usuario }) => {
    const { etapa, solicitudId, fleteroId } = await getFletePropio(fleteId, clienteId);
    const validacion = validarTransicion(etapa, "COMPLETADO", "CLIENTE", SIN_INVENTARIO);
    if (!validacion.ok) throw new ActionError("El fletero todavía no registró la entrega.");

    await conEventos(async (tx, { emitir }) => {
      const { count } = await tx.flete.updateMany({
        where: { id: fleteId, clienteId, etapa },
        data: { etapa: "COMPLETADO", recepcionConfirmadaEn: new Date() },
      });
      if (count === 0) throw new ActionError(CAMBIO_CONCURRENTE);
      await tx.estadoFlete.create({ data: { fleteId, etapa: "COMPLETADO", autorId: usuario.id } });
      await emitir({ solicitudId, fleteroId, evento: "RECEPCION_CONFIRMADA", datos: {} });
    });
    revalidatePath("/cliente", "layout");
    return null;
  },
});

export const cancelarFleteCliente = createClienteAction({
  schema: z.object({
    fleteId: id,
    motivo: z
      .string()
      .trim()
      .min(10, "Contale al fletero por qué cancelás (al menos 10 caracteres)")
      .max(300),
  }),
  handler: async ({ fleteId, motivo }, { clienteId, usuario }) => {
    const { etapa, solicitudId, fleteroId } = await getFletePropio(fleteId, clienteId);
    const validacion = validarTransicion(etapa, "CANCELADO", "CLIENTE", SIN_INVENTARIO);
    if (!validacion.ok) throw new ActionError("Solo se puede cancelar antes de que el fletero cargue.");

    await conEventos(async (tx, { emitir }) => {
      const { count } = await tx.flete.updateMany({
        where: { id: fleteId, clienteId, etapa },
        data: { etapa: "CANCELADO" },
      });
      if (count === 0) throw new ActionError(CAMBIO_CONCURRENTE);
      await tx.estadoFlete.create({
        data: { fleteId, etapa: "CANCELADO", autorId: usuario.id, nota: motivo },
      });
      await tx.solicitud.update({ where: { id: solicitudId }, data: { estado: "CANCELADA" } });
      // Bloquea el chat del par y le avisa al fletero con el motivo.
      await emitir({ solicitudId, fleteroId, evento: "FLETE_CANCELADO", datos: { motivo, por: "CLIENTE" } });
    });
    revalidatePath("/cliente", "layout");
    return null;
  },
});
