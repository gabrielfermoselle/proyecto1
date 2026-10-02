import { z } from "zod";
import { FRANJAS_HORARIAS } from "@/domain/catalogos";
import { LARGO_MAXIMO_MENSAJE, sanitizarTexto } from "@/domain/chat";
import { fechaIsoAr, sumarDias } from "@/domain/fechas";

const id = z.string().min(1).max(40);
/** Generado por el navegador (crypto.randomUUID): idempotencia del envío. */
const clientId = z.string().uuid();

/** El texto se sanitiza ANTES de validar el largo y el vacío: "  ​ " no es un mensaje. */
const texto = (maximo: number, permitirVacio: boolean) =>
  z
    .string()
    .max(maximo * 2, "El mensaje es demasiado largo")
    .transform(sanitizarTexto)
    .pipe(
      permitirVacio
        ? z.string().max(maximo, `Usá como máximo ${maximo} caracteres`)
        : z.string().min(1, "Escribí un mensaje").max(maximo, `Usá como máximo ${maximo} caracteres`),
    );

export const enviarMensajeSchema = z.object({
  conversacionId: id,
  clientId,
  texto: texto(LARGO_MAXIMO_MENSAJE, false),
});

export const prepararFotoSchema = z.object({ conversacionId: id });

export const enviarFotoSchema = z.object({
  conversacionId: id,
  clientId,
  ruta: z.string().min(1).max(300),
  ancho: z.number().int().positive().max(20_000),
  alto: z.number().int().positive().max(20_000),
  texto: texto(500, true).transform((v) => (v === "" ? null : v)),
});

export const marcarLeidoSchema = z.object({ conversacionId: id, hasta: z.string().datetime() });

/** Hasta 90 días hacia adelante: más que eso no es una fecha de flete realista. */
export const DIAS_MAXIMOS_PROPUESTA = 90;

export const proponerHorarioSchema = z
  .object({
    conversacionId: id,
    clientId,
    fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Elegí una fecha"),
    franja: z.enum(FRANJAS_HORARIAS, { errorMap: () => ({ message: "Elegí una franja horaria" }) }),
  })
  .refine((p) => p.fecha >= fechaIsoAr() && p.fecha <= sumarDias(fechaIsoAr(), DIAS_MAXIMOS_PROPUESTA), {
    message: `Elegí una fecha entre hoy y los próximos ${DIAS_MAXIMOS_PROPUESTA} días`,
    path: ["fecha"],
  });

export const responderPropuestaSchema = z.object({ propuestaId: id, aceptar: z.boolean() });

export type ProponerHorarioInput = z.input<typeof proponerHorarioSchema>;
