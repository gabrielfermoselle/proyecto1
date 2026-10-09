"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { FranjaHoraria } from "@/domain/catalogos";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { resumenInventario, validarTransicion } from "@/domain/ciclo-flete";
import { fechaIsoDeDia } from "@/domain/fechas";
import { conEventos } from "@/features/chat/eventos";
import { ActionError, createClienteAction, esViolacionUnica } from "@/lib/action";
import { ahoraIso, fallar, nuevoId, numero, relacion } from "@/lib/db";

const id = z.string().min(1).max(40);

interface PresupuestoAceptable {
  solicitudId: string;
  fleteroId: string;
  vehiculoId: string;
  monto: unknown;
  solicitudes: { clienteId: string } | { clienteId: string }[] | null;
}

function comoFecha(valor: unknown): Date {
  return valor instanceof Date ? valor : new Date(String(valor));
}

async function fechaAcordada(tx: SupabaseClient, solicitudId: string, fleteroId: string) {
  const { data: conversacion, error } = await tx
    .from("conversaciones")
    .select("id")
    .eq("solicitudId", solicitudId)
    .eq("fleteroId", fleteroId)
    .maybeSingle();
  fallar(error);
  if (!conversacion) return null;

  const { data: mensajes, error: errorMensajes } = await tx
    .from("mensajes")
    .select("id")
    .eq("conversacionId", conversacion.id);
  fallar(errorMensajes);
  const mensajeIds = (mensajes ?? []).map((m) => m.id as string);
  if (mensajeIds.length === 0) return null;

  const { data: acordada, error: errorAcordada } = await tx
    .from("propuestas_horario")
    .select("id, fecha, franja")
    .eq("estado", "ACEPTADA")
    .is("aplicadaEn", null)
    .in("mensajeId", mensajeIds)
    .order("respondidaEn", { ascending: false })
    .limit(1)
    .maybeSingle();
  fallar(errorAcordada);
  return acordada as { id: string; fecha: unknown; franja: string } | null;
}

/**
 * Acepta un presupuesto: crea el flete, adjudica la solicitud y rechaza los demás presupuestos.
 * Si en el chat ya se acordó otra fecha con este fletero, el flete queda con esa fecha.
 * Deja "Flete confirmado" en su chat y cierra los de los otros fleteros.
 */
export const aceptarPresupuesto = createClienteAction({
  schema: z.object({ presupuestoId: id }),
  handler: async ({ presupuestoId }, { clienteId, usuario }) => {
    const resultado = await conEventos(async (tx: SupabaseClient, { emitir }) => {
      const { data, error } = await tx
        .from("presupuestos")
        .select("solicitudId, fleteroId, vehiculoId, monto, solicitudes(clienteId)")
        .eq("id", presupuestoId)
        .maybeSingle();
      fallar(error);
      const presupuesto = data as PresupuestoAceptable | null;
      const dueno = relacion(presupuesto?.solicitudes);
      if (!presupuesto || dueno?.clienteId !== clienteId)
        throw new ActionError("No encontramos ese presupuesto.");
      const { solicitudId, fleteroId } = presupuesto;

      const marca = ahoraIso();
      const volverAAbierta = async () => {
        const { error: errorReverso } = await tx
          .from("solicitudes")
          .update({ estado: "ABIERTA", updatedAt: ahoraIso() })
          .eq("id", solicitudId)
          .eq("clienteId", clienteId)
          .eq("estado", "ADJUDICADA");
        fallar(errorReverso);
      };
      // El update condicionado reclama la fila: dos aceptaciones no adjudican la misma solicitud.
      const { data: solicitud, error: errorReclamo } = await tx
        .from("solicitudes")
        .update({ estado: "ADJUDICADA", updatedAt: marca })
        .eq("id", solicitudId)
        .eq("clienteId", clienteId)
        .eq("estado", "ABIERTA")
        .select("fecha, franja")
        .maybeSingle();
      fallar(errorReclamo);
      if (!solicitud) throw new ActionError("Esta solicitud ya no está abierta.");

      const { data: aceptados, error: errorAceptar } = await tx
        .from("presupuestos")
        .update({ estado: "ACEPTADO", updatedAt: marca })
        .eq("id", presupuestoId)
        .eq("estado", "PENDIENTE")
        .gte("validoHasta", marca)
        .select("id");
      fallar(errorAceptar);
      if (!aceptados?.length) {
        await volverAAbierta();
        throw new ActionError("Ese presupuesto venció o el fletero lo retiró.");
      }
      // La solicitud está abierta y tiene este presupuesto pendiente: PRESUPUESTADO → CONFIRMADO.
      const validacion = validarTransicion("PRESUPUESTADO", "CONFIRMADO", "CLIENTE", {
        inventario: resumenInventario([]),
        conformidad: false,
        motivo: null,
      });
      if (!validacion.ok) {
        await volverAAbierta();
        const { error: errorPresupuesto } = await tx
          .from("presupuestos")
          .update({ estado: "PENDIENTE", updatedAt: ahoraIso() })
          .eq("id", presupuestoId)
          .eq("estado", "ACEPTADO");
        fallar(errorPresupuesto);
        throw new ActionError(validacion.motivo);
      }

      // La última fecha que las partes aceptaron en el chat y todavía no se aplicó.
      const acordada = await fechaAcordada(tx, solicitudId, fleteroId);
      const fecha = fechaIsoDeDia(comoFecha(acordada?.fecha ?? solicitud.fecha));
      const franja = (acordada?.franja ?? solicitud.franja) as FranjaHoraria;
      if (acordada) {
        const { error: errorFecha } = await tx
          .from("solicitudes")
          .update({ fecha, franja, updatedAt: marca })
          .eq("id", solicitudId);
        fallar(errorFecha);
        const { error: errorAplicada } = await tx
          .from("propuestas_horario")
          .update({ aplicadaEn: marca })
          .eq("id", acordada.id);
        fallar(errorAplicada);
      }

      const fleteId = nuevoId();
      const { error: errorFlete } = await tx.from("fletes").insert({
        id: fleteId,
        solicitudId,
        presupuestoId,
        clienteId,
        fleteroId,
        vehiculoId: presupuesto.vehiculoId,
        precioAcordado: presupuesto.monto,
        updatedAt: marca,
      });
      if (esViolacionUnica(errorFlete)) throw new ActionError("Esta solicitud ya no está abierta.");
      fallar(errorFlete);
      const { error: errorEstado } = await tx.from("estados_flete").insert({
        id: nuevoId(),
        fleteId,
        etapa: "CONFIRMADO",
        autorId: usuario.id,
      });
      fallar(errorEstado);

      // Los demás presupuestos quedan rechazados y su chat, cerrado con aviso.
      const { data: otros, error: errorOtros } = await tx
        .from("presupuestos")
        .select("fleteroId")
        .eq("solicitudId", solicitudId)
        .eq("estado", "PENDIENTE");
      fallar(errorOtros);
      const { error: errorRechazo } = await tx
        .from("presupuestos")
        .update({ estado: "RECHAZADO", updatedAt: marca })
        .eq("solicitudId", solicitudId)
        .eq("estado", "PENDIENTE");
      fallar(errorRechazo);
      for (const otro of otros ?? []) {
        await emitir({
          solicitudId,
          fleteroId: otro.fleteroId as string,
          evento: "PRESUPUESTO_NO_ELEGIDO",
          datos: {},
        });
      }

      const conversacionId = await emitir({
        solicitudId,
        fleteroId,
        evento: "FLETE_CONFIRMADO",
        datos: { monto: numero(presupuesto.monto), fecha, franja },
      });
      return { fleteId, conversacionId };
    });
    revalidatePath("/cliente", "layout");
    return resultado;
  },
});
