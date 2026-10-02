// Datos de prueba para los tests de integración. Cada llamada crea registros nuevos con ids
// únicos, así los tests no dependen del orden ni se pisan entre sí.
import { randomUUID } from "node:crypto";
import type { FranjaHoraria } from "@prisma/client";
import { conEventos } from "@/features/chat/eventos";
import { prisma } from "@/lib/prisma";
import type { UsuarioActual } from "@/lib/session";

const sufijo = () => randomUUID().slice(0, 8);

/** Hoy y otros días relativos, en formato de columna @db.Date. */
export function dia(offset: number): Date {
  const ahora = new Date(Date.now() - 3 * 3600 * 1000); // Tucumán, UTC−3
  return new Date(Date.UTC(ahora.getUTCFullYear(), ahora.getUTCMonth(), ahora.getUTCDate() + offset));
}

export async function crearCliente(nombre = "Ana"): Promise<UsuarioActual> {
  const u = await prisma.user.create({
    data: {
      email: `${nombre.toLowerCase()}-${sufijo()}@test.local`,
      passwordHash: "x",
      nombre,
      apellido: "Prueba",
      rol: "CLIENTE",
      clienteProfile: { create: {} },
    },
    select: { id: true },
  });
  return cargarUsuario(u.id);
}

export async function crearFletero(nombre = "Carlos"): Promise<UsuarioActual & { vehiculoId: string }> {
  const u = await prisma.user.create({
    data: {
      email: `${nombre.toLowerCase()}-${sufijo()}@test.local`,
      passwordHash: "x",
      nombre,
      apellido: "Prueba",
      rol: "FLETERO",
      fleteroProfile: {
        create: {
          baseDireccion: "Av. Salta 650, San Miguel de Tucumán",
          baseLat: -26.8185,
          baseLng: -65.2105,
          radioCoberturaKm: 30,
          precioMinimo: 10_000,
          precioPorKm: 1_000,
          precioPorM3: 2_000,
          precioPorAyudante: 5_000,
          onboardingCompletadoEn: new Date(),
          vehiculos: {
            create: {
              tipo: "CAMIONETA",
              marca: "Ford",
              modelo: "Ranger",
              patente: `T${sufijo().toUpperCase()}`,
              capacidadKg: 1000,
              volumenM3: 6,
            },
          },
        },
      },
    },
    select: { id: true, fleteroProfile: { select: { vehiculos: { select: { id: true } } } } },
  });
  return { ...(await cargarUsuario(u.id)), vehiculoId: u.fleteroProfile!.vehiculos[0]!.id };
}

export async function crearAdmin(): Promise<UsuarioActual> {
  const u = await prisma.user.create({
    data: {
      email: `admin-${sufijo()}@test.local`,
      passwordHash: "x",
      nombre: "Admin",
      apellido: "Prueba",
      rol: "ADMIN",
    },
    select: { id: true },
  });
  return cargarUsuario(u.id);
}

/** Igual que getUsuarioActual: el usuario con sus perfiles, como lo ve la app. */
export async function cargarUsuario(id: string): Promise<UsuarioActual> {
  return prisma.user.findUniqueOrThrow({
    where: { id },
    select: {
      id: true,
      email: true,
      nombre: true,
      apellido: true,
      rol: true,
      activo: true,
      clienteProfile: { select: { id: true } },
      fleteroProfile: { select: { id: true, onboardingCompletadoEn: true } },
    },
  });
}

export async function crearSolicitud(
  cliente: UsuarioActual,
  opciones: { fecha?: Date; franja?: FranjaHoraria; items?: number; estado?: "ABIERTA" | "ADJUDICADA" } = {},
) {
  const cantidadItems = opciones.items ?? 2;
  return prisma.solicitud.create({
    data: {
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
      items: {
        create: Array.from({ length: cantidadItems }, (_, i) => ({
          nombre: ["Heladera", "Sillón", "Mesa", "Cajas"][i % 4]!,
          cantidad: 1,
          orden: i,
        })),
      },
    },
    select: { id: true, items: { orderBy: { orden: "asc" }, select: { id: true, nombre: true } } },
  });
}

/** Un presupuesto pendiente, con su conversación y el mensaje de sistema, como lo deja la app. */
export async function presupuestar(
  solicitudId: string,
  fletero: UsuarioActual & { vehiculoId: string },
  monto = 30_000,
  validoHasta = new Date(Date.now() + 48 * 3600 * 1000),
) {
  return conEventos(async (tx, { emitir }) => {
    const p = await tx.presupuesto.create({
      data: {
        solicitudId,
        fleteroId: fletero.fleteroProfile!.id,
        vehiculoId: fletero.vehiculoId,
        monto,
        montoSugerido: monto,
        validoHasta,
      },
      select: { id: true },
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
  const mensajes = await prisma.mensaje.findMany({
    where: { conversacion: { solicitudId, fleteroId }, tipo: "SISTEMA" },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: { evento: true },
  });
  return mensajes.map((m) => m.evento);
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
