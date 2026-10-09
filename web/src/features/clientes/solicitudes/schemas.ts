import { z } from "zod";
import { ESTADOS_INICIALES_ITEM, FRANJAS_HORARIAS, TIPOS_FLETE, TIPOS_VEHICULO } from "@/domain/catalogos";
import { estaEnRegion } from "@/domain/geo";
import { MAXIMO_ITEMS } from "@/domain/solicitud";

// Schemas de la solicitud del cliente. Los campos se llaman como las columnas, así el
// formulario, la acción y Prisma hablan el mismo idioma.

const id = z.string().min(1).max(40);

/** Un número opcional del formulario: "" o vacío es null. */
const numeroOpcional = (min: number, max: number, mensaje: string, entero = true) =>
  z
    .union([z.literal(""), z.null(), z.coerce.number({ invalid_type_error: mensaje })])
    .transform((v) => (v === "" || v === null ? null : v))
    .refine((v) => v === null || (v >= min && v <= max && (!entero || Number.isInteger(v))), mensaje);

const textoOpcional = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Usá como máximo ${max} caracteres`)
    .optional()
    .transform((v) => (v ? v : null));

export const itemSchema = z.object({
  nombre: z.string().trim().min(2, "Poné qué es (ej.: Heladera)").max(80),
  cantidad: z.coerce
    .number({ invalid_type_error: "Ingresá la cantidad" })
    .int("Usá un número entero")
    .min(1, "Al menos 1")
    .max(999),
  largoCm: numeroOpcional(1, 1000, "Entre 1 y 1000 cm"),
  anchoCm: numeroOpcional(1, 1000, "Entre 1 y 1000 cm"),
  altoCm: numeroOpcional(1, 1000, "Entre 1 y 1000 cm"),
  pesoKgAprox: numeroOpcional(0.1, 5000, "Entre 0,1 y 5000 kg", false),
  fragil: z.boolean().default(false),
  estadoInicial: z.enum(ESTADOS_INICIALES_ITEM).default("BUENO"),
  notas: textoOpcional(300),
});

const direccion = z.string().trim().min(5, "Buscá la dirección o marcá el punto en el mapa").max(200);
const coordenada = z.coerce.number({ invalid_type_error: "Marcá el punto en el mapa" });
const piso = numeroOpcional(0, 60, "Entre 0 (planta baja) y 60");

export const solicitudSchema = z
  .object({
    tipoFlete: z.enum(TIPOS_FLETE, { errorMap: () => ({ message: "Elegí qué tipo de flete es" }) }),
    titulo: z.string().trim().min(5, "Contalo en pocas palabras (ej.: Heladera y lavarropas)").max(120),
    descripcion: textoOpcional(1000),
    origenDireccion: direccion,
    origenLat: coordenada,
    origenLng: coordenada,
    origenPiso: piso,
    origenAscensor: z.boolean().default(false),
    destinoDireccion: direccion,
    destinoLat: coordenada,
    destinoLng: coordenada,
    destinoPiso: piso,
    destinoAscensor: z.boolean().default(false),
    fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Elegí el día"),
    franja: z.enum(FRANJAS_HORARIAS, { errorMap: () => ({ message: "Elegí el horario" }) }),
    tipoVehiculoSugerido: z
      .union([z.literal(""), z.enum(TIPOS_VEHICULO)])
      .optional()
      .transform((v) => (v ? v : null)),
    ayudantesRequeridos: z.coerce.number().int().min(0).max(10, "Hasta 10 ayudantes"),
    requiereEmbalaje: z.boolean().default(false),
    items: z
      .array(itemSchema)
      .min(1, "Agregá al menos un ítem")
      .max(MAXIMO_ITEMS, `Hasta ${MAXIMO_ITEMS} ítems`),
  })
  .refine((s) => estaEnRegion({ lat: s.origenLat, lng: s.origenLng }), {
    message: "El origen tiene que estar en Tucumán o alrededores",
    path: ["origenDireccion"],
  })
  .refine((s) => estaEnRegion({ lat: s.destinoLat, lng: s.destinoLng }), {
    message: "El destino tiene que estar en Tucumán o alrededores",
    path: ["destinoDireccion"],
  });

export type SolicitudInput = z.input<typeof solicitudSchema>;
export type SolicitudDatos = z.output<typeof solicitudSchema>;

export const cancelarSolicitudSchema = z.object({
  solicitudId: id,
  /** Lo ven los fleteros que la habían presupuestado. */
  motivo: z
    .string()
    .trim()
    .max(300, "Usá como máximo 300 caracteres")
    .optional()
    .transform((v) => (v ? v : null)),
});

export const prepararFotoSolicitudSchema = z.object({ solicitudId: id });

export const agregarFotoSolicitudSchema = z.object({
  solicitudId: id,
  /** Sin ítem: foto general de la solicitud. */
  itemId: id.nullable().optional(),
  ruta: z.string().min(1).max(300),
  ancho: z.number().int().min(1).max(10_000),
  alto: z.number().int().min(1).max(10_000),
});

export const quitarFotoSolicitudSchema = z.object({ fotoId: id });
