import "server-only";
import { prisma } from "@/lib/prisma";

/** Perfil del cliente para su página de perfil. Siempre por el `clienteId` de la sesión. */
export async function getPerfilCliente(clienteId: string) {
  const perfil = await prisma.clienteProfile.findUniqueOrThrow({
    where: { id: clienteId },
    select: {
      direccionHabitual: true,
      lat: true,
      lng: true,
      user: { select: { nombre: true, apellido: true, telefono: true, email: true } },
    },
  });
  return {
    email: perfil.user.email,
    datos: {
      nombre: perfil.user.nombre,
      apellido: perfil.user.apellido,
      telefono: perfil.user.telefono ?? "",
    },
    direccion: {
      direccionHabitual: perfil.direccionHabitual ?? "",
      lat: perfil.lat,
      lng: perfil.lng,
    },
  };
}

/** Punto de referencia por defecto del buscador: la dirección habitual, si la cargó. */
export async function getDireccionHabitual(clienteId: string) {
  const perfil = await prisma.clienteProfile.findUnique({
    where: { id: clienteId },
    select: { direccionHabitual: true, lat: true, lng: true },
  });
  return perfil?.lat != null && perfil.lng != null
    ? { direccion: perfil.direccionHabitual ?? "Tu dirección habitual", lat: perfil.lat, lng: perfil.lng }
    : null;
}
