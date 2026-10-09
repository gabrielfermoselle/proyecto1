import { z } from "zod";
import { FORMATO_HORA, VALIDECES } from "@/domain/presupuesto";

const id = z.string().min(1).max(40);

export const presupuestoSchema = z.object({
  solicitudId: id,
  vehiculoId: z
    .string({ required_error: "Elegí con qué vehículo hacés el flete" })
    .min(1, "Elegí con qué vehículo hacés el flete")
    .max(40),
  monto: z.coerce
    .number({ invalid_type_error: "Ingresá el monto" })
    .int("Usá un monto sin centavos")
    .min(1_000, "El monto mínimo es $1.000")
    .max(50_000_000, "Revisá el monto"),
  ayudantes: z.coerce.number().int().min(0).max(10, "Hasta 10 ayudantes"),
  /** Opcional: a qué hora llega al origen. Se valida contra la franja en el servidor. */
  horaLlegada: z
    .union([z.literal(""), z.string().regex(FORMATO_HORA, "Usá el formato HH:MM, ej. 09:30")])
    .optional()
    .transform((v) => (v ? v : null)),
  validez: z.enum(VALIDECES, { errorMap: () => ({ message: "Elegí hasta cuándo vale el presupuesto" }) }),
  mensaje: z
    .string()
    .trim()
    .max(500, "Usá como máximo 500 caracteres")
    .transform((v) => (v === "" ? null : v)),
});

export const retirarPresupuestoSchema = z.object({ presupuestoId: id });

export type PresupuestoInput = z.input<typeof presupuestoSchema>;
