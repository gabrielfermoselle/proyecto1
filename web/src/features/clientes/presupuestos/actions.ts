"use server";

import type { FranjaHoraria } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { resumenInventario, validarTransicion } from "@/domain/ciclo-flete";
import { fechaIsoDeDia } from "@/domain/fechas";
import { conEventos } from "@/features/chat/eventos";
import { ActionError, createClienteAction } from "@/lib/action";

const id = z.string().min(1).max(40);
// Un evento por cada presupuesto rechazado: con muchos, el límite de 5 s de Prisma no alcanza.
const OPCIONES_TRANSACCION = { timeout: 15_000 };

/**
 * Acepta un presupuesto: crea el flete, adjudica la solicitud y rechaza los demás presupuestos.
 * Si en el chat ya se acordó otra fecha con este fletero, el flete queda con esa fecha.
 * Deja "Flete confirmado" en su chat y cierra los de los otros fleteros.
 */
export const aceptarPresupuesto = createClienteAction({
  schema: z.object({ presupuestoId: id }),
  handler: async ({ presupuestoId }, { clienteId, usuario }) => {
    const resultado = await conEventos(async (tx, { emitir }) => {
      const presupuesto = await tx.presupuesto.findFirst({
        where: { id: presupuestoId, solicitud: { clienteId } },
        select: { solicitudId: true, fleteroId: true, vehiculoId: true, monto: true },
      });
      if (!presupuesto) throw new ActionError("No encontramos ese presupuesto.");
      const { solicitudId, fleteroId } = presupuesto;

      // Bloquea la solicitud: un fletero presupuestando en este momento (FOR SHARE) espera, y
      // dos aceptaciones simultáneas no pueden crear dos fletes.
      const [solicitud] = await tx.$queryRaw<{ fecha: Date; franja: FranjaHoraria }[]>`
        SELECT fecha, franja FROM solicitudes
        WHERE id = ${solicitudId} AND "clienteId" = ${clienteId} AND estado = 'ABIERTA'
        FOR UPDATE`;
      if (!solicitud) throw new ActionError("Esta solicitud ya no está abierta.");

      const ahora = new Date();
      const { count } = await tx.presupuesto.updateMany({
        where: { id: presupuestoId, estado: "PENDIENTE", validoHasta: { gte: ahora } },
        data: { estado: "ACEPTADO" },
      });
      if (count === 0) throw new ActionError("Ese presupuesto venció o el fletero lo retiró.");
      // La solicitud está abierta y tiene este presupuesto pendiente: PRESUPUESTADO → CONFIRMADO.
      const validacion = validarTransicion("PRESUPUESTADO", "CONFIRMADO", "CLIENTE", {
        inventario: resumenInventario([]),
        conformidad: false,
        motivo: null,
      });
      if (!validacion.ok) throw new ActionError(validacion.motivo);

      // La última fecha que las partes aceptaron en el chat y todavía no se aplicó.
      const acordada = await tx.propuestaHorario.findFirst({
        where: {
          estado: "ACEPTADA",
          aplicadaEn: null,
          mensaje: { conversacion: { solicitudId, fleteroId } },
        },
        orderBy: { respondidaEn: "desc" },
        select: { id: true, fecha: true, franja: true },
      });
      const fecha = acordada?.fecha ?? solicitud.fecha;
      const franja = acordada?.franja ?? solicitud.franja;
      await tx.solicitud.update({
        where: { id: solicitudId },
        data: { estado: "ADJUDICADA", fecha, franja },
      });
      if (acordada) {
        await tx.propuestaHorario.update({ where: { id: acordada.id }, data: { aplicadaEn: ahora } });
      }

      const flete = await tx.flete.create({
        data: {
          solicitudId,
          presupuestoId,
          clienteId,
          fleteroId,
          vehiculoId: presupuesto.vehiculoId,
          precioAcordado: presupuesto.monto,
        },
        select: { id: true },
      });
      await tx.estadoFlete.create({ data: { fleteId: flete.id, etapa: "CONFIRMADO", autorId: usuario.id } });

      // Los demás presupuestos quedan rechazados y su chat, cerrado con aviso.
      const otros = await tx.presupuesto.findMany({
        where: { solicitudId, estado: "PENDIENTE" },
        select: { fleteroId: true },
      });
      await tx.presupuesto.updateMany({
        where: { solicitudId, estado: "PENDIENTE" },
        data: { estado: "RECHAZADO" },
      });
      for (const otro of otros) {
        await emitir({ solicitudId, fleteroId: otro.fleteroId, evento: "PRESUPUESTO_NO_ELEGIDO", datos: {} });
      }

      const conversacionId = await emitir({
        solicitudId,
        fleteroId,
        evento: "FLETE_CONFIRMADO",
        datos: { monto: presupuesto.monto.toNumber(), fecha: fechaIsoDeDia(fecha), franja },
      });
      return { fleteId: flete.id, conversacionId };
    }, OPCIONES_TRANSACCION);
    revalidatePath("/cliente", "layout");
    return resultado;
  },
});
