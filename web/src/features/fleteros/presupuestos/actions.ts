"use server";

import { revalidatePath } from "next/cache";
import { evaluarCompatibilidad, ETIQUETA_COMPATIBILIDAD, puedeLlevar } from "@/domain/compatibilidad";
import { fechaIsoAr, fechaIsoDeDia } from "@/domain/fechas";
import { precioSugerido } from "@/domain/precio";
import { FRANJA, type FranjaHoraria } from "@/domain/catalogos";
import { calcularValidoHasta, horaEnFranja } from "@/domain/presupuesto";
import { conEventos } from "@/features/chat/eventos";
import { crearMensajeDeTexto } from "@/features/chat/mensajes";
import { consultaAccesoSolicitud } from "@/features/fleteros/solicitudes/consultas-sql";
import { ActionError, createFleteroAction, esViolacionUnica } from "@/lib/action";
import { ahoraIso, consulta, db, fallar, nuevoId, numero } from "@/lib/db";
import { presupuestoSchema, retirarPresupuestoSchema } from "./schemas";

const YA_PRESUPUESTADA = "Ya enviaste un presupuesto para esta solicitud.";

interface SolicitudAbierta {
  fecha: string;
  franja: FranjaHoraria;
  distanciaKm: number | string;
  pesoTotalKg: number | string;
  volumenTotalM3: number | string;
  itemsSinMedidas: number | string;
}

/**
 * Envía un presupuesto. Todo lo que importa se recalcula en el servidor: el acceso (radio y
 * estado), la compatibilidad del vehículo, el precio sugerido y la fecha de vencimiento.
 * El cliente solo aporta el monto, el vehículo, los ayudantes, la validez y el mensaje.
 */
export const enviarPresupuesto = createFleteroAction({
  schema: presupuestoSchema,
  handler: async (
    { solicitudId, vehiculoId, monto, ayudantes, horaLlegada, validez, mensaje },
    { fleteroId, usuario },
  ) => {
    const hoy = fechaIsoAr();
    const accesoSql = consultaAccesoSolicitud(fleteroId, solicitudId, hoy);
    const [perfil, accesoFilas, vehiculo] = await Promise.all([
      (async () => {
        const { data, error } = await db()
          .from("perfiles_fletero")
          .select("disponible, precioMinimo, precioPorKm, precioPorM3, precioPorAyudante")
          .eq("id", fleteroId)
          .single();
        fallar(error);
        if (!data) throw new Error("No se encontró el registro");
        return data as {
          disponible: boolean;
          precioMinimo: number | string;
          precioPorKm: number | string;
          precioPorM3: number | string;
          precioPorAyudante: number | string;
        };
      })(),
      consulta<{ permitido: boolean }>(accesoSql.sql, accesoSql.params),
      (async () => {
        const { data, error } = await db()
          .from("vehiculos")
          .select("capacidadKg, volumenM3")
          .eq("id", vehiculoId)
          .eq("fleteroId", fleteroId)
          .eq("activo", true)
          .maybeSingle();
        fallar(error);
        return data as { capacidadKg: number; volumenM3: number | string } | null;
      })(),
    ]);
    const acceso = accesoFilas[0];

    if (!perfil.disponible)
      throw new ActionError("Estás en pausa. Activá tu disponibilidad para enviar presupuestos.");
    if (!acceso?.permitido) throw new ActionError("No encontramos esa solicitud.");
    if (!vehiculo)
      throw new ActionError("Elegí uno de tus vehículos activos.", {
        vehiculoId: ["Elegí uno de tus vehículos activos."],
      });

    try {
      await conEventos(async (tx, { emitir, publicarDespues }) => {
        // Sin FOR SHARE: el update condicional reclama la fila solo si sigue abierta y vigente.
        // Después de insertar se relee el estado; si el cliente la adjudicó en el medio, se borra el presupuesto.
        const { data: reclamada, error: errorReclamo } = await tx
          .from("solicitudes")
          .update({ updatedAt: ahoraIso() })
          .eq("id", solicitudId)
          .eq("estado", "ABIERTA")
          .gte("fecha", hoy)
          .select("fecha, franja, distanciaKm, pesoTotalKg, volumenTotalM3, itemsSinMedidas")
          .maybeSingle();
        fallar(errorReclamo);
        const solicitud = reclamada as SolicitudAbierta | null;
        if (!solicitud) throw new ActionError("Esta solicitud ya no recibe presupuestos.");
        if (horaLlegada && !horaEnFranja(horaLlegada, FRANJA[solicitud.franja])) {
          const { desde, hasta } = FRANJA[solicitud.franja];
          const motivo = `El cliente lo pidió entre las ${desde} y las ${hasta} h: elegí una hora en esa franja.`;
          throw new ActionError(motivo, { horaLlegada: [motivo] });
        }

        const compatibilidad = evaluarCompatibilidad(
          {
            pesoTotalKg: numero(solicitud.pesoTotalKg),
            volumenTotalM3: numero(solicitud.volumenTotalM3),
            itemsSinMedidas: numero(solicitud.itemsSinMedidas),
          },
          {
            capacidadKg: numero(vehiculo.capacidadKg),
            volumenM3: numero(vehiculo.volumenM3),
          },
        );
        if (!puedeLlevar(compatibilidad)) {
          const motivo = `${ETIQUETA_COMPATIBILIDAD[compatibilidad]}: elegí otro vehículo.`;
          throw new ActionError(motivo, { vehiculoId: [motivo] });
        }

        const distanciaKm = numero(solicitud.distanciaKm);
        const volumenM3 = numero(solicitud.volumenTotalM3);
        const montoSugerido = precioSugerido(
          { distanciaLinealKm: distanciaKm, volumenM3, ayudantes },
          {
            precioMinimo: numero(perfil.precioMinimo),
            precioPorKm: numero(perfil.precioPorKm),
            precioPorM3: numero(perfil.precioPorM3),
            precioPorAyudante: numero(perfil.precioPorAyudante),
          },
        );

        const validoHasta = calcularValidoHasta(validez, fechaIsoDeDia(new Date(solicitud.fecha)));
        const presupuestoId = nuevoId();
        const { error: errorInsert } = await tx.from("presupuestos").insert({
          id: presupuestoId,
          solicitudId,
          fleteroId,
          vehiculoId,
          monto,
          montoSugerido,
          incluyeAyudantes: ayudantes,
          horaLlegada,
          mensaje,
          validoHasta: validoHasta.toISOString(),
          updatedAt: ahoraIso(),
        });
        fallar(errorInsert);

        const { data: vigente, error: errorVigente } = await tx
          .from("solicitudes")
          .select("estado")
          .eq("id", solicitudId)
          .maybeSingle();
        fallar(errorVigente);
        if ((vigente as { estado: string } | null)?.estado !== "ABIERTA") {
          const { error: errorBorrar } = await tx.from("presupuestos").delete().eq("id", presupuestoId);
          fallar(errorBorrar);
          throw new ActionError("Esta solicitud ya no recibe presupuestos.");
        }

        // Presupuestar habilita el chat: crea la conversación y deja el aviso del sistema.
        const conversacionId = await emitir({
          solicitudId,
          fleteroId,
          evento: "PRESUPUESTO_ENVIADO",
          datos: { monto, validoHasta: validoHasta.toISOString() },
        });
        // El mensaje del presupuesto abre la conversación, como si el fletero lo hubiera escrito.
        if (mensaje) {
          publicarDespues(await crearMensajeDeTexto(tx, { conversacionId, autor: usuario, texto: mensaje }));
        }
      });
    } catch (error) {
      if (esViolacionUnica(error)) throw new ActionError(YA_PRESUPUESTADA);
      throw error;
    }

    revalidatePath("/fletero", "layout");
    return null;
  },
});

/** Retira un presupuesto pendiente. No se puede volver a enviar otro para la misma solicitud. */
export const retirarPresupuesto = createFleteroAction({
  schema: retirarPresupuestoSchema,
  handler: async ({ presupuestoId }, { fleteroId }) => {
    await conEventos(async (tx, { emitir }) => {
      const { data, error } = await tx
        .from("presupuestos")
        .update({ estado: "RETIRADO", updatedAt: ahoraIso() })
        .eq("id", presupuestoId)
        .eq("fleteroId", fleteroId)
        .eq("estado", "PENDIENTE")
        .select("solicitudId")
        .maybeSingle();
      fallar(error);
      const presupuesto = data as { solicitudId: string } | null;
      if (!presupuesto) throw new ActionError("Ese presupuesto ya no se puede retirar.");
      await emitir({
        solicitudId: presupuesto.solicitudId,
        fleteroId,
        evento: "PRESUPUESTO_RETIRADO",
        datos: {},
      });
    });
    revalidatePath("/fletero", "layout");
    return null;
  },
});
