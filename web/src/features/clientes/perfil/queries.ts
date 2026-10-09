import "server-only";
import { db, fallar, numero, relacion } from "@/lib/db";

interface UsuarioPerfil {
  nombre: string;
  apellido: string;
  telefono: string | null;
  email: string;
}

/** Perfil del cliente para su página de perfil. Siempre por el `clienteId` de la sesión. */
export async function getPerfilCliente(clienteId: string) {
  const { data, error } = await db()
    .from("perfiles_cliente")
    .select("direccionHabitual, lat, lng, usuarios(nombre, apellido, telefono, email)")
    .eq("id", clienteId)
    .maybeSingle();
  fallar(error);
  const user = relacion(data?.usuarios as UsuarioPerfil | UsuarioPerfil[] | null);
  if (!data || !user) throw new Error("No encontramos tu perfil de cliente.");
  return {
    email: user.email,
    datos: {
      nombre: user.nombre,
      apellido: user.apellido,
      telefono: user.telefono ?? "",
    },
    direccion: {
      direccionHabitual: (data.direccionHabitual as string | null) ?? "",
      lat: data.lat as number | null,
      lng: data.lng as number | null,
    },
  };
}

/** Punto de referencia por defecto del buscador: la dirección habitual, si la cargó. */
export async function getDireccionHabitual(clienteId: string) {
  const { data, error } = await db()
    .from("perfiles_cliente")
    .select("direccionHabitual, lat, lng")
    .eq("id", clienteId)
    .maybeSingle();
  fallar(error);
  return data?.lat != null && data.lng != null
    ? {
        direccion: (data.direccionHabitual as string | null) ?? "Tu dirección habitual",
        lat: numero(data.lat),
        lng: numero(data.lng),
      }
    : null;
}
