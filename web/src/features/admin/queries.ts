import "server-only";
import type { EstadoReclamo, Prisma, Rol } from "@prisma/client";
import { ETAPAS_ACTIVAS } from "@/domain/ciclo-flete";
import { fechaIsoAr, fechaIsoDeDia } from "@/domain/fechas";
import { urlsFirmadas } from "@/features/uploads/storage";
import { prisma } from "@/lib/prisma";

// Consultas del panel de administración. El admin ve nombres completos y emails: los necesita
// para gestionar cuentas. Nunca contraseñas (ni sus hashes).

const nombreCompleto = (u: { nombre: string; apellido: string }) => `${u.nombre} ${u.apellido}`;

/** Fletes cuyo día ya pasó y no empezaron: los mismos que avisa el mantenimiento diario. */
const filtroDemorados = (): Prisma.FleteWhereInput => ({
  etapa: { in: ["CONFIRMADO", "EN_CAMINO_A_ORIGEN"] },
  solicitud: { fecha: { lt: new Date(`${fechaIsoAr()}T00:00:00.000Z`) } },
});

export async function getResumenAdmin() {
  const [porRol, inactivos, sinVerificar, solicitudesAbiertas, fletesActivos, demorados, reclamosAbiertos] =
    await Promise.all([
      prisma.user.groupBy({ by: ["rol"], _count: true }),
      prisma.user.count({ where: { activo: false } }),
      prisma.fleteroProfile.count({ where: { verificado: false, onboardingCompletadoEn: { not: null } } }),
      prisma.solicitud.count({ where: { estado: "ABIERTA" } }),
      prisma.flete.count({ where: { etapa: { in: [...ETAPAS_ACTIVAS] } } }),
      prisma.flete.count({ where: filtroDemorados() }),
      prisma.reclamo.count({ where: { estado: "ABIERTO" } }),
    ]);
  const cuantos = (rol: Rol) => porRol.find((r) => r.rol === rol)?._count ?? 0;
  return {
    clientes: cuantos("CLIENTE"),
    fleteros: cuantos("FLETERO"),
    inactivos,
    sinVerificar,
    solicitudesAbiertas,
    fletesActivos,
    demorados,
    reclamosAbiertos,
  };
}

export async function getFletesDemorados() {
  const fletes = await prisma.flete.findMany({
    where: filtroDemorados(),
    orderBy: { solicitud: { fecha: "asc" } },
    take: 50,
    select: {
      id: true,
      etapa: true,
      solicitud: { select: { titulo: true, fecha: true } },
      cliente: { select: { user: { select: { nombre: true, apellido: true, email: true } } } },
      fletero: { select: { user: { select: { nombre: true, apellido: true, email: true } } } },
    },
  });
  return fletes.map((f) => ({
    id: f.id,
    etapa: f.etapa,
    titulo: f.solicitud.titulo,
    fecha: fechaIsoDeDia(f.solicitud.fecha),
    cliente: { nombre: nombreCompleto(f.cliente.user), email: f.cliente.user.email },
    fletero: { nombre: nombreCompleto(f.fletero.user), email: f.fletero.user.email },
  }));
}

export const ROLES_FILTRO = ["CLIENTE", "FLETERO", "ADMIN"] as const;
const POR_PAGINA = 40;

export async function getUsuarios({ q, rol, pagina }: { q: string; rol: Rol | null; pagina: number }) {
  const texto = q.trim();
  const where: Prisma.UserWhereInput = {
    ...(rol ? { rol } : {}),
    ...(texto
      ? {
          OR: [
            { email: { contains: texto, mode: "insensitive" } },
            { nombre: { contains: texto, mode: "insensitive" } },
            { apellido: { contains: texto, mode: "insensitive" } },
          ],
        }
      : {}),
  };
  const [usuarios, total] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (pagina - 1) * POR_PAGINA,
      take: POR_PAGINA,
      select: {
        id: true,
        nombre: true,
        apellido: true,
        email: true,
        rol: true,
        activo: true,
        createdAt: true,
        fleteroProfile: {
          select: {
            id: true,
            verificado: true,
            onboardingCompletadoEn: true,
            ratingPromedio: true,
            cantidadCalificaciones: true,
          },
        },
      },
    }),
    prisma.user.count({ where }),
  ]);
  return {
    total,
    paginas: Math.max(1, Math.ceil(total / POR_PAGINA)),
    usuarios: usuarios.map((u) => ({
      id: u.id,
      nombre: nombreCompleto(u),
      email: u.email,
      rol: u.rol,
      activo: u.activo,
      alta: u.createdAt,
      fletero: u.fleteroProfile
        ? {
            id: u.fleteroProfile.id,
            verificado: u.fleteroProfile.verificado,
            onboardingCompleto: u.fleteroProfile.onboardingCompletadoEn !== null,
            rating:
              u.fleteroProfile.cantidadCalificaciones > 0 ? u.fleteroProfile.ratingPromedio.toNumber() : null,
            calificaciones: u.fleteroProfile.cantidadCalificaciones,
          }
        : null,
    })),
  };
}

export type UsuarioAdmin = Awaited<ReturnType<typeof getUsuarios>>["usuarios"][number];

export async function getReclamos(estado: EstadoReclamo) {
  const reclamos = await prisma.reclamo.findMany({
    where: { estado },
    orderBy: { createdAt: estado === "ABIERTO" ? "asc" : "desc" },
    take: 50,
    select: {
      id: true,
      descripcion: true,
      estado: true,
      createdAt: true,
      resolucion: true,
      resueltoEn: true,
      resueltoPor: { select: { nombre: true, apellido: true } },
      fotos: { select: { id: true, ruta: true, ancho: true, alto: true } },
      item: {
        select: {
          nombre: true,
          cantidad: true,
          controles: { select: { fase: true, resultado: true, observacion: true } },
        },
      },
      flete: {
        select: {
          id: true,
          solicitud: { select: { titulo: true } },
          cliente: { select: { user: { select: { nombre: true, apellido: true, email: true } } } },
          fletero: { select: { user: { select: { nombre: true, apellido: true, email: true } } } },
        },
      },
    },
  });
  const urls = await urlsFirmadas(reclamos.flatMap((r) => r.fotos.map((f) => f.ruta)));
  return reclamos.map((r) => ({
    id: r.id,
    descripcion: r.descripcion,
    estado: r.estado,
    fecha: r.createdAt,
    resolucion: r.resolucion,
    resueltoEn: r.resueltoEn,
    resueltoPor: r.resueltoPor ? nombreCompleto(r.resueltoPor) : null,
    fotos: r.fotos.flatMap(({ ruta, ...f }) => {
      const url = urls.get(ruta);
      return url ? [{ ...f, url }] : [];
    }),
    item: `${r.item.cantidad > 1 ? `${r.item.cantidad} × ` : ""}${r.item.nombre}`,
    /** Lo que registró el fletero sobre ese ítem: sirve para decidir. */
    controles: r.item.controles,
    fleteId: r.flete.id,
    titulo: r.flete.solicitud.titulo,
    cliente: { nombre: nombreCompleto(r.flete.cliente.user), email: r.flete.cliente.user.email },
    fletero: { nombre: nombreCompleto(r.flete.fletero.user), email: r.flete.fletero.user.email },
  }));
}

export type ReclamoAdmin = Awaited<ReturnType<typeof getReclamos>>[number];

export async function getSolicitudesAdmin() {
  const filas = await prisma.solicitud.findMany({
    orderBy: { createdAt: "desc" },
    take: 60,
    select: {
      id: true,
      titulo: true,
      estado: true,
      fecha: true,
      createdAt: true,
      cliente: { select: { user: { select: { nombre: true, apellido: true } } } },
      flete: { select: { id: true, etapa: true } },
      _count: { select: { presupuestos: true } },
    },
  });
  return filas.map((s) => ({
    id: s.id,
    titulo: s.titulo,
    estado: s.estado,
    fecha: fechaIsoDeDia(s.fecha),
    publicada: s.createdAt,
    cliente: nombreCompleto(s.cliente.user),
    presupuestos: s._count.presupuestos,
    flete: s.flete,
  }));
}
