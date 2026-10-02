import { z } from "zod";
import { ETAPAS_FLETE, FASES_CONTROL, RESULTADOS_CONTROL } from "@/domain/catalogos";
import { LARGO_MINIMO_MOTIVO } from "@/domain/ciclo-flete";

const id = z.string().min(1).max(40);

/** Posición del navegador del fletero. Opcional: si no la comparte, la etapa avanza igual. */
export const ubicacionSchema = z
  .object({
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
    precisionM: z.number().int().min(0).max(100_000).nullable(),
  })
  .nullable()
  .optional();

export type Ubicacion = NonNullable<z.infer<typeof ubicacionSchema>>;

const textoOpcional = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Usá como máximo ${max} caracteres`)
    .nullable()
    .optional()
    .transform((v) => (v ? v : null));

export const fotoSubidaSchema = z.object({
  ruta: z.string().min(1).max(300),
  ancho: z.number().int().min(1).max(10_000),
  alto: z.number().int().min(1).max(10_000),
});

export const avanzarEtapaSchema = z.object({
  fleteId: id,
  hacia: z.enum(ETAPAS_FLETE),
  ubicacion: ubicacionSchema,
  conformidad: z.boolean().optional(),
});

export const cancelarFleteSchema = z.object({
  fleteId: id,
  motivo: z
    .string()
    .trim()
    .min(LARGO_MINIMO_MOTIVO, `Contá por qué cancelás (al menos ${LARGO_MINIMO_MOTIVO} caracteres)`)
    .max(300),
  ubicacion: ubicacionSchema,
});

export const registrarControlSchema = z.object({
  fleteId: id,
  itemId: id,
  fase: z.enum(FASES_CONTROL),
  resultado: z.enum(RESULTADOS_CONTROL),
  observacion: textoOpcional(300),
  foto: fotoSubidaSchema.nullable().optional(),
});

export const quitarControlSchema = z.object({ fleteId: id, itemId: id, fase: z.enum(FASES_CONTROL) });

export const marcarTodosSchema = z.object({ fleteId: id, fase: z.enum(FASES_CONTROL) });

export const prepararFotoSchema = z.object({ fleteId: id });

export const calificarSchema = z.object({
  fleteId: id,
  puntaje: z.number().int().min(1, "Elegí de 1 a 5 estrellas").max(5),
  comentario: textoOpcional(1000),
});
