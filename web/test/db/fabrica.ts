// Datos de prueba para los tests de integración. Cada llamada crea registros nuevos con ids
// únicos, así los tests no dependen del orden ni se pisan entre sí.
import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { FranjaHoraria } from "@/domain/catalogos";
import { conEventos } from "@/features/chat/eventos";
import { db, fallar, relacion } from "@/lib/db";
import { insertar as insertarFila } from "@/lib/filas";
import type { UsuarioActual } from "@/lib/session";
import { filas, insertar } from "./tabla";

const sufijo = () => randomUUID().slice(0, 8);

/** Hoy y otros días relativos, en formato de columna date. */
export function dia(offset: number): Date {
  const ahora = new Date(Date.now() - 3 * 3600 * 1000); // Tucumán, UTC−3
  return new Date(Date.UTC(ahora.getUTCFullYear(), ahora.getUTCMonth(), ahora.getUTCDate() + offset));
}

export async function crearCliente(nombre = "Ana"): Promise<UsuarioActual> {
  const usuario = await insertar<{ id: string }>("usuarios", {
    email: `${nombre.toLowerCase()}-${sufijo()}@test.local`,
    passwordHash: "x",
    nombre,
    apellido: "Prueba",
    rol: "CLIENTE",
  });
  await insertar("perfiles_cliente", { userId: usuario.id });
  return cargarUsuario(usuario.id);
}

export async function crearFletero(nombre = "Carlos"): Promise<UsuarioActual & { vehiculoId: string }> {
  const usuario = await insertar<{ id: string }>("usuarios", {
    email: `${nombre.toLowerCase()}-${sufijo()}@test.local`,
    passwordHash: "x",
    nombre,
    apellido: "Prueba",
    rol: "FLETERO",
  });
  const perfil = await insertar<{ id: string }>("perfiles_fletero", {
    userId: usuario.id,
    baseDireccion: "Av. Salta 650, San Miguel de Tucumán",
    baseLat: -26.8185,
    baseLng: -65.2105,
    radioCoberturaKm: 30,
    precioMinimo: 10_000,
    precioPorKm: 1_000,
    precioPorM3: 2_000,
    precioPorAyudante: 5_000,
    onboardingCompletadoEn: new Date(),
  });
  const vehiculo = await insertar<{ id: string }>("vehiculos", {
    fleteroId: perfil.id,
    tipo: "CAMIONETA",
    marca: "Ford",
    modelo: "Ranger",
    patente: `T${sufijo().toUpperCase()}`,
    capacidadKg: 1000,
    volumenM3: 6,
  });
  return { ...(await cargarUsuario(usuario.id)), vehiculoId: vehiculo.id };
}

export async function crearAdmin(): Promise<UsuarioActual> {
  const usuario = await insertar<{ id: string }>("usuarios", {
    email: `admin-${sufijo()}@test.local`,
    passwordHash: "x",
    nombre: "Admin",
    apellido: "Prueba",
    rol: "ADMIN",
  });
  return cargarUsuario(usuario.id);
}

/** Igual que getUsuarioActual: el usuario con sus perfiles, como lo ve la app. */
export async function cargarUsuario(id: string): Promise<UsuarioActual> {
  const { data, error } = await db()
    .from("usuarios")
    .select(
      "id, email, nombre, apellido, rol, activo, perfiles_cliente(id), perfiles_fletero(id, onboardingCompletadoEn)",
    )
    .eq("id", id)
    .single();
  fallar(error);
  return {
    id: data.id as string,
    email: data.email as string,
    nombre: data.nombre as string,
    apellido: data.apellido as string,
    rol: data.rol as UsuarioActual["rol"],
    activo: data.activo as boolean,
    clienteProfile: relacion(data.perfiles_cliente as { id: string } | { id: string }[] | null),
    fleteroProfile: relacion(
      data.perfiles_fletero as
        | { id: string; onboardingCompletadoEn: string | null }
        | { id: string; onboardingCompletadoEn: string | null }[]
        | null,
    ),
  };
}

export async function crearSolicitud(
  cliente: UsuarioActual,
  opciones: { fecha?: Date; franja?: FranjaHoraria; items?: number; estado?: "ABIERTA" | "ADJUDICADA" } = {},
) {
  const cantidadItems = opciones.items ?? 2;
  const solicitud = await insertar<{ id: string }>("solicitudes", {
    clienteId: cliente.clienteProfile!.id,
    tipoFlete: "MUEBLES",
    titulo: `Mudanza ${sufijo()}`,
    origenDireccion: "Av. Roca 420, Barrio Sur",
    origenLat: -26.8405,
    origenLng: -65.2062,
    destinoDireccion: "Av. Mate de Luna 2400, Ciudadela",
    destinoLat: -26.8211,
    destinoLng: -65.2302,
    distanciaKm: 3.2,
    fecha: opciones.fecha ?? dia(3),
    franja: opciones.franja ?? "MANANA",
    estado: opciones.estado ?? "ABIERTA",
  });
  const nombres = ["Heladera", "Sillón", "Mesa", "Cajas"];
  const items = [];
  for (let i = 0; i < cantidadItems; i++) {
    const item = await insertar<{ id: string; nombre: string }>("items_inventario", {
      solicitudId: solicitud.id,
      nombre: nombres[i % 4]!,
      cantidad: 1,
      orden: i,
    });
    items.push({ id: item.id, nombre: item.nombre });
  }
  return { id: solicitud.id, items };
}

/** Un presupuesto pendiente, con su conversación y el mensaje de sistema, como lo deja la app. */
export async function presupuestar(
  solicitudId: string,
  fletero: UsuarioActual & { vehiculoId: string },
  monto = 30_000,
  validoHasta = new Date(Date.now() + 48 * 3600 * 1000),
) {
  return conEventos(async (tx: SupabaseClient, { emitir }) => {
    const p = await insertarFila<{ id: string }>(tx, "presupuestos", {
      solicitudId,
      fleteroId: fletero.fleteroProfile!.id,
      vehiculoId: fletero.vehiculoId,
      monto,
      montoSugerido: monto,
      validoHasta,
    });
    const conversacionId = await emitir({
      solicitudId,
      fleteroId: fletero.fleteroProfile!.id,
      evento: "PRESUPUESTO_ENVIADO",
      datos: { monto, validoHasta: validoHasta.toISOString() },
    });
    return { presupuestoId: p.id, conversacionId };
  });
}

/** Eventos de sistema de la conversación de un par, en orden. */
export async function eventosDelChat(solicitudId: string, fleteroId: string) {
  const conversacion = await unoConversacion(solicitudId, fleteroId);
  if (!conversacion) return [];
  const mensajes = await filas<{ evento: string | null }>(
    "mensajes",
    { conversacionId: conversacion.id, tipo: "SISTEMA" },
    { columna: "createdAt" },
  );
  return mensajes.map((m) => m.evento);
}

async function unoConversacion(solicitudId: string, fleteroId: string) {
  const lista = await filas<{ id: string }>("conversaciones", { solicitudId, fleteroId });
  return lista[0] ?? null;
}

/** Desenvuelve un ActionResult exitoso (o falla el test con el mensaje del error). */
export function ok<T>(r: { ok: true; data: T } | { ok: false; error: string }): T {
  if (!r.ok) throw new Error(`Se esperaba éxito y falló: ${r.error}`);
  return r.data;
}

/** El mensaje de error de un ActionResult fallido (o falla el test si salió bien). */
export function error(r: { ok: true } | { ok: false; error: string }): string {
  if (r.ok) throw new Error("Se esperaba un error y salió bien");
  return r.error;
}
