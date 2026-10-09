import { z } from "zod";
import { TIPOS_DOCUMENTO, TIPOS_VEHICULO } from "@/domain/catalogos";
import { estaEnRegion } from "@/domain/geo";
import { esPatenteValida, normalizarPatente } from "@/domain/patente";
import { nombreSchema, telefonoSchema } from "@/features/auth/schemas";

// Schemas del perfil del fletero: los usan el onboarding y la página de perfil.

const id = z.string().min(1).max(40);

const entero = (min: number, max: number, mensajeMin: string) =>
  z.coerce
    .number({ invalid_type_error: "Ingresá un número" })
    .int("Usá un número entero")
    .min(min, mensajeMin)
    .max(max, `El máximo es ${max.toLocaleString("es-AR")}`);

const pesos = (min: number, mensajeMin: string) => entero(min, 10_000_000, mensajeMin);

export const datosSchema = z.object({
  nombre: nombreSchema("nombre"),
  apellido: nombreSchema("apellido"),
  telefono: telefonoSchema.refine(
    (v) => v !== null,
    "Necesitamos un teléfono para avisarte de pedidos y cambios",
  ),
  dni: z
    .string()
    .trim()
    .transform((v) => v.replace(/[.\s]/g, ""))
    .refine((v) => /^\d{7,8}$/.test(v), "Ingresá tu DNI sin puntos (7 u 8 números)"),
  bio: z
    .string()
    .trim()
    .max(500, "Usá como máximo 500 caracteres")
    .transform((v) => (v === "" ? null : v)),
});

export const vehiculoSchema = z.object({
  tipo: z.enum(TIPOS_VEHICULO, { errorMap: () => ({ message: "Elegí el tipo de vehículo" }) }),
  marca: z.string().trim().min(2, "Ingresá la marca").max(40),
  modelo: z.string().trim().min(1, "Ingresá el modelo").max(40),
  anio: z
    .union([z.literal(""), entero(1960, new Date().getFullYear() + 1, "Ingresá un año válido")])
    .transform((v) => (v === "" ? null : v)),
  patente: z
    .string()
    .transform(normalizarPatente)
    .refine(esPatenteValida, "Formato válido: AB123CD, ABC123, A123BCD o 123ABC"),
  capacidadKg: entero(1, 40_000, "Indicá cuántos kg puede llevar"),
  volumenM3: z.coerce
    .number({ invalid_type_error: "Ingresá un número" })
    .min(0.01, "Indicá el volumen de carga")
    .max(120, "El máximo es 120 m³"),
});

export const vehiculoEdicionSchema = vehiculoSchema.extend({ id });

export const estadoVehiculoSchema = z.object({ id, activo: z.boolean() });

export const zonaSchema = z
  .object({
    baseDireccion: z.string().trim().min(3, "Buscá una dirección o marcá el punto en el mapa").max(200),
    baseLat: z.coerce.number(),
    baseLng: z.coerce.number(),
    radioCoberturaKm: entero(1, 100, "El radio mínimo es 1 km"),
  })
  .refine((z) => estaEnRegion({ lat: z.baseLat, lng: z.baseLng }), {
    message: "El punto tiene que estar en Tucumán o alrededores",
    path: ["baseDireccion"],
  });

export const tarifasSchema = z.object({
  precioMinimo: pesos(1, "Indicá el precio mínimo de un flete"),
  precioPorKm: pesos(1, "Indicá cuánto cobrás por km"),
  precioPorM3: pesos(0, "No puede ser negativo"),
  precioPorAyudante: pesos(0, "No puede ser negativo"),
});

export const disponibilidadSchema = z.object({ disponible: z.boolean() });

export const fotoVehiculoSchema = z.object({
  vehiculoId: id,
  ruta: z.string().min(1).max(300),
  ancho: z.number().int().positive().max(20_000),
  alto: z.number().int().positive().max(20_000),
});

export type DatosInput = z.input<typeof datosSchema>;
export type VehiculoInput = z.input<typeof vehiculoSchema>;
export type ZonaInput = z.input<typeof zonaSchema>;
export type TarifasInput = z.input<typeof tarifasSchema>;

const tipoDocumento = z.enum(TIPOS_DOCUMENTO, { errorMap: () => ({ message: "Elegí qué documento es" }) });

export const tipoDocumentoSchema = z.object({ tipo: tipoDocumento });

export const documentoSchema = z.object({
  tipo: tipoDocumento,
  ruta: z.string().min(1).max(300),
});
