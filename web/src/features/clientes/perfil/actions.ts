"use server";

import { revalidatePath } from "next/cache";
import { createClienteAction } from "@/lib/action";
import { prisma } from "@/lib/prisma";
import { datosClienteSchema, direccionHabitualSchema } from "./schemas";

// Las dos acciones operan sobre el usuario y el perfil de la sesión: no reciben IDs.

export const guardarDatosCliente = createClienteAction({
  schema: datosClienteSchema,
  handler: async ({ nombre, apellido, telefono }, { usuario }) => {
    await prisma.user.update({ where: { id: usuario.id }, data: { nombre, apellido, telefono } });
    revalidatePath("/cliente", "layout");
    return null;
  },
});

/** La dirección habitual es el punto por defecto del buscador de fleteros. */
export const guardarDireccionHabitual = createClienteAction({
  schema: direccionHabitualSchema,
  handler: async ({ direccionHabitual, lat, lng }, { clienteId }) => {
    await prisma.clienteProfile.update({ where: { id: clienteId }, data: { direccionHabitual, lat, lng } });
    revalidatePath("/cliente", "layout");
    return null;
  },
});
