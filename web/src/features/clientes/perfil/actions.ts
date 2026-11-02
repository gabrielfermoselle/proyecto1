"use server";

import { revalidatePath } from "next/cache";
import { createClienteAction } from "@/lib/action";
import { ahoraIso, db, fallar } from "@/lib/db";
import { datosClienteSchema, direccionHabitualSchema } from "./schemas";

// Las dos acciones operan sobre el usuario y el perfil de la sesión: no reciben IDs.

export const guardarDatosCliente = createClienteAction({
  schema: datosClienteSchema,
  handler: async ({ nombre, apellido, telefono }, { usuario }) => {
    const { error } = await db()
      .from("usuarios")
      .update({ nombre, apellido, telefono, updatedAt: ahoraIso() })
      .eq("id", usuario.id);
    fallar(error);
    revalidatePath("/cliente", "layout");
    revalidatePath("/perfil");
    return null;
  },
});

/** La dirección habitual es el punto por defecto del buscador de fleteros. */
export const guardarDireccionHabitual = createClienteAction({
  schema: direccionHabitualSchema,
  handler: async ({ direccionHabitual, lat, lng }, { clienteId }) => {
    const { error } = await db()
      .from("perfiles_cliente")
      .update({ direccionHabitual, lat, lng })
      .eq("id", clienteId);
    fallar(error);
    revalidatePath("/cliente", "layout");
    revalidatePath("/perfil");
    return null;
  },
});
