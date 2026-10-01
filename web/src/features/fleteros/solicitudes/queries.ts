import "server-only";
import type { FranjaHoraria, TipoFlete } from "@/domain/catalogos";
import { conflictosCon } from "@/domain/agenda";
import {
  evaluarCompatibilidad,
  puedeLlevar,
  vehiculoSugerido,
  type ResultadoCompatibilidad,
} from "@/domain/compatibilidad";
import { direccionAproximada } from "@/domain/direccion";
import { fechaIsoAr, fechaIsoDeDia } from "@/domain/fechas";
import { aproximarCoordenadas, FACTOR_RUTA_URBANA, type Coordenadas } from "@/domain/geo";
import { precioSugerido } from "@/domain/precio";
import { getTurnosActivos } from "@/features/fleteros/fletes/queries";
import { nombrePublico } from "@/lib/formato";
import { prisma } from "@/lib/prisma";
import {
  consultaAccesoSolicitud,
  consultaConteosFeed,
  consultaFeed,
  type FilaFeed,
  type OrdenFeed,
  type TabFeed,
} from "./consultas-sql";

export const POR_PAGINA = 20;

async function getVehiculosActivos(fleteroId: string) {
  const vehiculos = await prisma.vehiculo.findMany({
    where: { fleteroId, activo: true },
    orderBy: { volumenM3: "asc" },
    select: { id: true, tipo: true, marca: true, modelo: true, capacidadKg: true, volumenM3: true },
  });
  return vehiculos.map((v) => ({ ...v, volumenM3: v.volumenM3.toNumber() }));
}

type VehiculoActivo = Awaited<ReturnType<typeof getVehiculosActivos>>[number];

/** Lo que se muestra de una solicitud antes de la adjudicación: zona, no dirección exacta. */
function aTarjeta(fila: FilaFeed, vehiculos: VehiculoActivo[]) {
  const carga = {
    pesoTotalKg: fila.pesoTotalKg,
    volumenTotalM3: fila.volumenTotalM3,
    itemsSinMedidas: fila.itemsSinMedidas,
  };
  const sugerido = vehiculoSugerido(carga, vehiculos);
  return {
    id: fila.id,
    titulo: fila.titulo,
    tipoFlete: fila.tipoFlete as TipoFlete,
    fecha: fila.fecha,
    franja: fila.franja as FranjaHoraria,
    zonaOrigen: direccionAproximada(fila.origenDireccion),
    zonaDestino: direccionAproximada(fila.destinoDireccion),
    ubicacion: aproximarCoordenadas({ lat: fila.origenLat, lng: fila.origenLng }),
    distanciaBaseKm: fila.distanciaBaseKm,
    recorridoKm: fila.distanciaKm * FACTOR_RUTA_URBANA,
    ...carga,
    cantidadItems: fila.cantidadItems,
    itemsFragiles: fila.itemsFragiles,
    ayudantesRequeridos: fila.ayudantesRequeridos,
    presupuestosRecibidos: fila.presupuestosRecibidos,
    miMonto: fila.miMonto,
    vehiculoSugerido: sugerido ? `${sugerido.marca} ${sugerido.modelo}` : null,
  };
}

export type TarjetaSolicitud = ReturnType<typeof aTarjeta>;

export async function getFeed(
  fleteroId: string,
  opciones: { tab: TabFeed; orden: OrdenFeed; pagina: number },
) {
  const hoy = fechaIsoAr();
  const limite = POR_PAGINA * opciones.pagina;
  const [filas, conteos, perfil, vehiculos] = await Promise.all([
    prisma.$queryRaw<FilaFeed[]>(
      consultaFeed({ fleteroId, hoy, tab: opciones.tab, orden: opciones.orden, limite: limite + 1 }),
    ),
    prisma.$queryRaw<{ nuevas: number; presupuestadas: number }[]>(consultaConteosFeed({ fleteroId, hoy })),
    prisma.fleteroProfile.findUniqueOrThrow({
      where: { id: fleteroId },
      select: { disponible: true, radioCoberturaKm: true, baseLat: true, baseLng: true },
    }),
    getVehiculosActivos(fleteroId),
  ]);

  return {
    solicitudes: filas.slice(0, limite).map((fila) => aTarjeta(fila, vehiculos)),
    hayMas: filas.length > limite,
    conteos: conteos[0] ?? { nuevas: 0, presupuestadas: 0 },
    perfil: {
      disponible: perfil.disponible,
      radioKm: perfil.radioCoberturaKm,
      base:
        perfil.baseLat !== null && perfil.baseLng !== null
          ? { lat: perfil.baseLat, lng: perfil.baseLng }
          : null,
    },
  };
}

/**
 * Detalle de una solicitud para el fletero, o `null` si no la puede ver (la página responde 404
 * sin revelar si existe). La dirección exacta solo se muestra si el flete es suyo.
 */
export async function getSolicitudParaFletero(fleteroId: string, solicitudId: string) {
  const hoy = fechaIsoAr();
  const [acceso] = await prisma.$queryRaw<{ permitido: boolean; distanciaBaseKm: number }[]>(
    consultaAccesoSolicitud(fleteroId, solicitudId, hoy),
  );
  if (!acceso?.permitido) return null;

  const [s, perfil, vehiculos, turnos] = await Promise.all([
    prisma.solicitud.findUniqueOrThrow({
      where: { id: solicitudId },
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
        cliente: { select: { user: { select: { nombre: true, apellido: true } } } },
        fotos: { select: { id: true, url: true, ancho: true, alto: true } },
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
            fotos: { select: { id: true, url: true, ancho: true, alto: true } },
          },
        },
        flete: { select: { id: true, fleteroId: true } },
        presupuestos: {
          where: { fleteroId },
          select: {
            id: true,
            monto: true,
            estado: true,
            validoHasta: true,
            mensaje: true,
            incluyeAyudantes: true,
          },
        },
        _count: { select: { presupuestos: { where: { estado: "PENDIENTE" } } } },
      },
    }),
    prisma.fleteroProfile.findUniqueOrThrow({
      where: { id: fleteroId },
      select: {
        disponible: true,
        precioMinimo: true,
        precioPorKm: true,
        precioPorM3: true,
        precioPorAyudante: true,
      },
    }),
    getVehiculosActivos(fleteroId),
    getTurnosActivos(fleteroId),
  ]);

  const esMiFlete = s.flete?.fleteroId === fleteroId;
  const ubicar = (direccion: string, punto: Coordenadas) =>
    esMiFlete
      ? { direccion, punto, exacta: true }
      : { direccion: direccionAproximada(direccion), punto: aproximarCoordenadas(punto), exacta: false };

  const carga = {
    pesoTotalKg: s.pesoTotalKg.toNumber(),
    volumenTotalM3: s.volumenTotalM3.toNumber(),
    itemsSinMedidas: s.itemsSinMedidas,
  };
  const tarifas = {
    precioMinimo: perfil.precioMinimo.toNumber(),
    precioPorKm: perfil.precioPorKm.toNumber(),
    precioPorM3: perfil.precioPorM3.toNumber(),
    precioPorAyudante: perfil.precioPorAyudante.toNumber(),
  };
  const fecha = fechaIsoDeDia(s.fecha);
  const sugerido = vehiculoSugerido(carga, vehiculos);
  const miPresupuesto = s.presupuestos[0];

  return {
    id: s.id,
    titulo: s.titulo,
    descripcion: s.descripcion,
    tipoFlete: s.tipoFlete,
    estado: s.estado,
    fecha,
    franja: s.franja,
    publicadaEn: s.createdAt,
    cliente: nombrePublico(s.cliente.user.nombre, s.cliente.user.apellido),
    origen: {
      ...ubicar(s.origenDireccion, { lat: s.origenLat, lng: s.origenLng }),
      piso: s.origenPiso,
      ascensor: s.origenAscensor,
    },
    destino: {
      ...ubicar(s.destinoDireccion, { lat: s.destinoLat, lng: s.destinoLng }),
      piso: s.destinoPiso,
      ascensor: s.destinoAscensor,
    },
    distanciaLinealKm: s.distanciaKm.toNumber(),
    recorridoKm: s.distanciaKm.toNumber() * FACTOR_RUTA_URBANA,
    distanciaBaseKm: acceso.distanciaBaseKm,
    carga,
    ayudantesRequeridos: s.ayudantesRequeridos,
    tipoVehiculoSugerido: s.tipoVehiculoSugerido,
    fotos: [...s.fotos, ...s.items.flatMap((i) => i.fotos)],
    items: s.items.map((i) => ({ ...i, pesoKgAprox: i.pesoKgAprox?.toNumber() ?? null })),
    presupuestosRecibidos: s._count.presupuestos,
    fleteId: esMiFlete ? (s.flete?.id ?? null) : null,
    miPresupuesto: miPresupuesto ? { ...miPresupuesto, monto: miPresupuesto.monto.toNumber() } : null,
    // Para el formulario de presupuesto:
    disponible: perfil.disponible,
    tarifas,
    vehiculos: vehiculos.map((v) => {
      const resultado: ResultadoCompatibilidad = evaluarCompatibilidad(carga, v);
      return { ...v, compatibilidad: resultado, puedeLlevar: puedeLlevar(resultado) };
    }),
    vehiculoSugeridoId: sugerido?.id ?? null,
    precioSugerido: precioSugerido(
      {
        distanciaLinealKm: s.distanciaKm.toNumber(),
        volumenM3: carga.volumenTotalM3,
        ayudantes: s.ayudantesRequeridos,
      },
      tarifas,
    ),
    conflictos: conflictosCon({ fecha, franja: s.franja }, turnos).filter((t) => t.solicitudId !== s.id),
  };
}

export type SolicitudParaFletero = NonNullable<Awaited<ReturnType<typeof getSolicitudParaFletero>>>;
