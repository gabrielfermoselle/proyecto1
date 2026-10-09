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
import { prisma } from "@/lib/prisma";
import { presupuestoSchema, retirarPresupuestoSchema } from "./schemas";

const YA_PRESUPUESTADA = "Ya enviaste un presupuesto para esta solicitud.";

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
    const [perfil, [acceso], vehiculo] = await Promise.all([
      prisma.fleteroProfile.findUniqueOrThrow({
        where: { id: fleteroId },
        select: {
          disponible: true,
          precioMinimo: true,
          precioPorKm: true,
          precioPorM3: true,
          precioPorAyudante: true,
        },
      }),
      prisma.$queryRaw<{ permitido: boolean }[]>(consultaAccesoSolicitud(fleteroId, solicitudId, hoy)),
      prisma.vehiculo.findFirst({
        where: { id: vehiculoId, fleteroId, activo: true },
        select: { capacidadKg: true, volumenM3: true },
      }),
    ]);

    if (!perfil.disponible)
      throw new ActionError("Estás en pausa. Activá tu disponibilidad para enviar presupuestos.");
    if (!acceso?.permitido) throw new ActionError("No encontramos esa solicitud.");
    if (!vehiculo)
      throw new ActionError("Elegí uno de tus vehículos activos.", {
        vehiculoId: ["Elegí uno de tus vehículos activos."],
      });

    try {
      await conEventos(async (tx, { emitir, publicarDespues }) => {
        // Bloquea la solicitud mientras se crea el presupuesto: si el cliente está aceptando
        // otro en este momento, una de las dos operaciones espera a la otra.
        const [solicitud] = await tx.$queryRaw<
          {
            fecha: Date;
            franja: FranjaHoraria;
            distanciaKm: number;
            pesoTotalKg: number;
            volumenTotalM3: number;
            itemsSinMedidas: number;
          }[]
        >`SELECT fecha, franja::text AS franja, "distanciaKm"::float8 AS "distanciaKm", "pesoTotalKg"::float8 AS "pesoTotalKg",
                 "volumenTotalM3"::float8 AS "volumenTotalM3", "itemsSinMedidas"
          FROM solicitudes WHERE id = ${solicitudId} AND estado = 'ABIERTA' AND fecha >= ${hoy}::date
          FOR SHARE`;
        if (!solicitud) throw new ActionError("Esta solicitud ya no recibe presupuestos.");
        if (horaLlegada && !horaEnFranja(horaLlegada, FRANJA[solicitud.franja])) {
          const { desde, hasta } = FRANJA[solicitud.franja];
          const motivo = `El cliente lo pidió entre las ${desde} y las ${hasta} h: elegí una hora en esa franja.`;
          throw new ActionError(motivo, { horaLlegada: [motivo] });
        }

        const compatibilidad = evaluarCompatibilidad(solicitud, {
          capacidadKg: vehiculo.capacidadKg,
          volumenM3: vehiculo.volumenM3.toNumber(),
        });
        if (!puedeLlevar(compatibilidad)) {
          const motivo = `${ETIQUETA_COMPATIBILIDAD[compatibilidad]}: elegí otro vehículo.`;
          throw new ActionError(motivo, { vehiculoId: [motivo] });
        }

        const montoSugerido = precioSugerido(
          { distanciaLinealKm: solicitud.distanciaKm, volumenM3: solicitud.volumenTotalM3, ayudantes },
          {
            precioMinimo: perfil.precioMinimo.toNumber(),
            precioPorKm: perfil.precioPorKm.toNumber(),
            precioPorM3: perfil.precioPorM3.toNumber(),
            precioPorAyudante: perfil.precioPorAyudante.toNumber(),
          },
        );

        const validoHasta = calcularValidoHasta(validez, fechaIsoDeDia(solicitud.fecha));
        await tx.presupuesto.create({
          data: {
            solicitudId,
            fleteroId,
            vehiculoId,
            monto,
            montoSugerido,
            incluyeAyudantes: ayudantes,
            horaLlegada,
            mensaje,
            validoHasta,
          },
        });

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
      const presupuesto = await tx.presupuesto.findFirst({
        where: { id: presupuestoId, fleteroId, estado: "PENDIENTE" },
        select: { solicitudId: true },
      });
      const { count } = await tx.presupuesto.updateMany({
        where: { id: presupuestoId, fleteroId, estado: "PENDIENTE" },
        data: { estado: "RETIRADO" },
      });
      if (!presupuesto || count === 0) throw new ActionError("Ese presupuesto ya no se puede retirar.");
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
