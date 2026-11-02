import { z } from "zod";
import { estaEnRegion } from "@/domain/geo";
import { nombreSchema, telefonoSchema } from "@/features/auth/schemas";

// Schemas del perfil del cliente: los comparten los formularios y las Server Actions.

export const datosClienteSchema = z.object({
  nombre: nombreSchema("nombre"),
  apellido: nombreSchema("apellido"),
  /** Opcional para el cliente: solo lo usamos para avisos importantes. */
  telefono: telefonoSchema,
});

export const direccionHabitualSchema = z
  .object({
    direccionHabitual: z.string().trim().min(3, "Buscá una dirección o marcá el punto en el mapa").max(200),
    lat: z.coerce.number(),
    lng: z.coerce.number(),
  })
  .refine((d) => estaEnRegion({ lat: d.lat, lng: d.lng }), {
    message: "El punto tiene que estar en Tucumán o alrededores",
    path: ["direccionHabitual"],
  });

export type DatosClienteInput = z.input<typeof datosClienteSchema>;
export type DireccionHabitualInput = z.input<typeof direccionHabitualSchema>;
