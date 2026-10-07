import "server-only";
import type { EstadoInicialItem, EstadoPresupuesto, EstadoSolicitud } from "@prisma/client";
import { estaVencido } from "@/domain/presupuesto";
import { fechaIsoDeDia } from "@/domain/fechas";
import { urlsFirmadas } from "@/features/uploads/storage";
import { nombrePublico } from "@/lib/formato";
import { prisma } from "@/lib/prisma";

// Solicitudes del cliente: siempre filtradas por su clienteId (si no es suya, no existe).

export async function getSolicitudesDelCliente(clienteId: string) {
  const filas = await prisma.solicitud.findMany({
    where: { clienteId },
    orderBy: [{ fecha: "asc" }, { createdAt: "desc" }],
    take: 60,
    select: {
      id: true,
      titulo: true,
      tipoFlete: true,
      estado: true,
      fecha: true,
      franja: true,
      origenDireccion: true,
      destinoDireccion: true,
      createdAt: true,
      flete: { select: { id: true, etapa: true } },
      _count: { select: { items: true, presupuestos: { where: { estado: "PENDIENTE" } } } },
    },
  });
  return filas.map((s) => ({
    id: s.id,
    titulo: s.titulo,
    tipoFlete: s.tipoFlete,
    estado: s.estado,
    fecha: fechaIsoDeDia(s.fecha),
    franja: s.franja,
    origen: s.origenDireccion,
    destino: s.destinoDireccion,
    items: s._count.items,
    presupuestosPendientes: s._count.presupuestos,
    flete: s.flete,
  }));
}

export type SolicitudDeLista = Awaited<ReturnType<typeof getSolicitudesDelCliente>>[number];

interface FotoFila {
  id: string;
  ruta: string;
  ancho: number | null;
  alto: number | null;
}

export async function getSolicitudDelCliente(clienteId: string, solicitudId: string) {
  const s = await prisma.solicitud.findFirst({
    where: { id: solicitudId, clienteId },
    select: {
      id: true,
      titulo: true,
      descripcion: true,
      tipoFlete: true,
      estado: true,
      fecha: true,
      franja: true,
      origenDireccion: true,
      origenLat: true,
      origenLng: true,
      origenPiso: true,
      origenAscensor: true,
      destinoDireccion: true,
      destinoLat: true,
      destinoLng: true,
      destinoPiso: true,
      destinoAscensor: true,
      distanciaKm: true,
      pesoTotalKg: true,
      volumenTotalM3: true,
      itemsSinMedidas: true,
      ayudantesRequeridos: true,
      tipoVehiculoSugerido: true,
      createdAt: true,
      fotos: { select: { id: true, ruta: true, ancho: true, alto: true } },
      items: {
        orderBy: { orden: "asc" },
        select: {
          id: true,
          nombre: true,
          cantidad: true,
          largoCm: true,
          anchoCm: true,
          altoCm: true,
          pesoKgAprox: true,
          fragil: true,
          notas: true,
          estadoInicial: true,
          fotos: { select: { id: true, ruta: true, ancho: true, alto: true } },
        },
      },
      flete: { select: { id: true, etapa: true } },
      presupuestos: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          monto: true,
          estado: true,
          validoHasta: true,
          mensaje: true,
          incluyeAyudantes: true,
          createdAt: true,
          vehiculo: { select: { tipo: true, marca: true, modelo: true } },
          fletero: {
            select: {
              id: true,
              verificado: true,
              ratingPromedio: true,
              cantidadCalificaciones: true,
              user: { select: { nombre: true, apellido: true } },
            },
          },
        },
      },
    },
  });
  if (!s) return null;

  const fleteroIds = [...new Set(s.presupuestos.map((p) => p.fletero.id))];
  const [completados, conversaciones] = await Promise.all([
    prisma.flete.groupBy({
      by: ["fleteroId"],
      where: { fleteroId: { in: fleteroIds }, etapa: "CERRADO" },
      _count: true,
    }),
    prisma.conversacion.findMany({
      where: { solicitudId, fleteroId: { in: fleteroIds } },
      select: { id: true, fleteroId: true },
    }),
  ]);
  const completadosPor = new Map(completados.map((c) => [c.fleteroId, c._count]));
  const conversacionPor = new Map(conversaciones.map((c) => [c.fleteroId, c.id]));

  const todas: FotoFila[] = [...s.fotos, ...s.items.flatMap((i) => i.fotos)];
  const urls = await urlsFirmadas(todas.map((f) => f.ruta));
  const fotos = (filas: FotoFila[]) =>
    filas.flatMap(({ ruta, ...f }) => {
      const url = urls.get(ruta);
      return url ? [{ ...f, url }] : [];
    });

  const ahora = new Date();
  return {
    id: s.id,
    titulo: s.titulo,
    descripcion: s.descripcion,
    tipoFlete: s.tipoFlete,
    estado: s.estado as EstadoSolicitud,
    fecha: fechaIsoDeDia(s.fecha),
    franja: s.franja,
    publicadaEn: s.createdAt,
    origen: {
      direccion: s.origenDireccion,
      lat: s.origenLat,
      lng: s.origenLng,
      piso: s.origenPiso,
      ascensor: s.origenAscensor,
    },
    destino: {
      direccion: s.destinoDireccion,
      lat: s.destinoLat,
      lng: s.destinoLng,
      piso: s.destinoPiso,
      ascensor: s.destinoAscensor,
    },
    distanciaKm: s.distanciaKm.toNumber(),
    carga: {
      pesoTotalKg: s.pesoTotalKg.toNumber(),
      volumenTotalM3: s.volumenTotalM3.toNumber(),
      itemsSinMedidas: s.itemsSinMedidas,
    },
    ayudantesRequeridos: s.ayudantesRequeridos,
    tipoVehiculoSugerido: s.tipoVehiculoSugerido,
    fotos: fotos(s.fotos),
    items: s.items.map((i) => ({
      id: i.id,
      nombre: i.nombre,
      cantidad: i.cantidad,
      medidas: i.largoCm && i.anchoCm && i.altoCm ? `${i.largoCm} × ${i.anchoCm} × ${i.altoCm} cm` : null,
      pesoKgAprox: i.pesoKgAprox?.toNumber() ?? null,
      fragil: i.fragil,
      notas: i.notas,
      estadoInicial: i.estadoInicial as EstadoInicialItem,
      fotos: fotos(i.fotos),
    })),
    flete: s.flete,
    presupuestos: s.presupuestos.map((p) => ({
      id: p.id,
      monto: p.monto.toNumber(),
      estado: p.estado as EstadoPresupuesto,
      vencido: p.estado === "PENDIENTE" && estaVencido(p.validoHasta, ahora),
      validoHasta: p.validoHasta,
      mensaje: p.mensaje,
      ayudantes: p.incluyeAyudantes,
      vehiculo: p.vehiculo,
      fletero: {
        id: p.fletero.id,
        nombre: nombrePublico(p.fletero.user.nombre, p.fletero.user.apellido),
        verificado: p.fletero.verificado,
      },
      rating: p.fletero.cantidadCalificaciones > 0 ? p.fletero.ratingPromedio.toNumber() : null,
      calificaciones: p.fletero.cantidadCalificaciones,
      fletesCompletados: completadosPor.get(p.fletero.id) ?? 0,
      conversacionId: conversacionPor.get(p.fletero.id) ?? null,
    })),
  };
}

export type SolicitudDelCliente = NonNullable<Awaited<ReturnType<typeof getSolicitudDelCliente>>>;
export type PresupuestoRecibido = SolicitudDelCliente["presupuestos"][number];
