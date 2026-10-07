import "server-only";
import type { TipoVehiculo } from "@prisma/client";
import { FACTOR_RUTA_URBANA, type Coordenadas } from "@/domain/geo";
import { precioSugerido } from "@/domain/precio";
import { direccionAproximada } from "@/domain/direccion";
import { getDireccionHabitual } from "@/features/clientes/perfil/queries";
import { nombrePublico } from "@/lib/formato";
import { prisma } from "@/lib/prisma";
import {
  consultaBuscador,
  type CargaReferencia,
  type FilaBuscador,
  type OrdenBuscador,
  type RadioBuscador,
} from "./consultas-sql";
import { direccionEscrita, type ParametrosBuscadorUrl, type Referencia } from "./parametros";

// Buscador de fleteros para el cliente. Mismos criterios que el perfil público: solo activos
// y con el onboarding completo, y nunca la dirección exacta de la base.

const POR_PAGINA = 30;

/** Desde dónde se mide la cercanía y, con una solicitud, qué carga hay que llevar. */
export interface ReferenciaBusqueda {
  tipo: Referencia;
  punto: Coordenadas | null;
  /** Texto para mostrar: la dirección o el título de la solicitud. */
  etiqueta: string | null;
  carga: CargaReferencia | null;
}

/**
 * Resuelve el punto de referencia pedido. La solicitud tiene que ser del cliente y estar
 * abierta; si lo pedido no es válido (o no hay dirección habitual), se busca sin punto.
 */
export async function resolverReferencia(
  clienteId: string,
  p: ParametrosBuscadorUrl,
): Promise<ReferenciaBusqueda> {
  if (p.ref === "solicitud" && p.solicitud) {
    const s = await prisma.solicitud.findFirst({
      where: { id: p.solicitud, clienteId, estado: "ABIERTA" },
      select: {
        titulo: true,
        origenLat: true,
        origenLng: true,
        distanciaKm: true,
        pesoTotalKg: true,
        volumenTotalM3: true,
        ayudantesRequeridos: true,
      },
    });
    if (s) {
      return {
        tipo: "solicitud",
        punto: { lat: s.origenLat, lng: s.origenLng },
        etiqueta: s.titulo,
        carga: {
          distanciaKm: s.distanciaKm.toNumber(),
          pesoTotalKg: s.pesoTotalKg.toNumber(),
          volumenTotalM3: s.volumenTotalM3.toNumber(),
          ayudantes: s.ayudantesRequeridos,
        },
      };
    }
  }
  if (p.ref === "direccion") {
    const escrita = direccionEscrita(p);
    if (escrita) {
      return { tipo: "direccion", punto: escrita, etiqueta: escrita.direccion, carga: null };
    }
  }
  const habitual = await getDireccionHabitual(clienteId);
  return habitual
    ? { tipo: "habitual", punto: habitual, etiqueta: habitual.direccion, carga: null }
    : { tipo: "habitual", punto: null, etiqueta: null, carga: null };
}

/** Solicitudes abiertas del cliente, para elegirlas como referencia. */
export function getSolicitudesAbiertas(clienteId: string) {
  return prisma.solicitud.findMany({
    where: { clienteId, estado: "ABIERTA" },
    orderBy: { fecha: "asc" },
    select: { id: true, titulo: true },
    take: 20,
  });
}

export interface FiltrosFleteros {
  referencia: ReferenciaBusqueda;
  radio: RadioBuscador;
  tipoVehiculo: TipoVehiculo | null;
  soloDisponibles: boolean;
  precioMaximo: number | null;
  ratingMinimo: number | null;
  orden: OrdenBuscador;
}

const tarifas = (f: FilaBuscador) => ({
  precioMinimo: f.precioMinimo,
  precioPorKm: f.precioPorKm,
  precioPorM3: f.precioPorM3,
  precioPorAyudante: f.precioPorAyudante,
});

export async function buscarFleteros(f: FiltrosFleteros) {
  const { punto, carga } = f.referencia;
  const filas = await prisma.$queryRaw<FilaBuscador[]>(
    consultaBuscador({
      punto,
      radio: f.radio,
      tipoVehiculo: f.tipoVehiculo,
      soloDisponibles: f.soloDisponibles,
      precioMaximo: f.precioMaximo,
      ratingMinimo: f.ratingMinimo,
      carga,
      // Sin punto no hay distancia: se ordena por calificación.
      orden: f.orden === "distancia" && !punto ? "calificacion" : f.orden,
      factorRuta: FACTOR_RUTA_URBANA,
      limite: POR_PAGINA,
    }),
  );
  const ids = filas.map((fila) => fila.id);

  const [perfiles, completados] = await Promise.all([
    prisma.fleteroProfile.findMany({
      where: { id: { in: ids } },
      select: {
        id: true,
        bio: true,
        verificado: true,
        disponible: true,
        baseDireccion: true,
        ratingPromedio: true,
        cantidadCalificaciones: true,
        user: { select: { nombre: true, apellido: true } },
        vehiculos: { where: { activo: true }, select: { tipo: true, marca: true, modelo: true } },
      },
    }),
    prisma.flete.groupBy({
      by: ["fleteroId"],
      where: { fleteroId: { in: ids }, etapa: "CERRADO" },
      _count: true,
    }),
  ]);
  const perfilPor = new Map(perfiles.map((p) => [p.id, p]));
  const completadosPor = new Map(completados.map((c) => [c.fleteroId, c._count]));

  // El orden lo decide la consulta SQL; acá solo se completan los datos de cada tarjeta.
  return filas.flatMap((fila) => {
    const p = perfilPor.get(fila.id);
    if (!p) return [];
    return [
      {
        id: p.id,
        nombre: nombrePublico(p.user.nombre, p.user.apellido),
        bio: p.bio,
        verificado: p.verificado,
        disponible: p.disponible,
        zona: p.baseDireccion ? direccionAproximada(p.baseDireccion) : null,
        radioKm: fila.radioCoberturaKm,
        distanciaKm: fila.distanciaKm,
        /** El punto de referencia está dentro de su radio de cobertura. */
        cubreZona: fila.distanciaKm === null ? null : fila.distanciaKm <= fila.radioCoberturaKm,
        precioMinimo: fila.precioMinimo,
        precioEstimado: carga
          ? precioSugerido(
              { distanciaLinealKm: carga.distanciaKm, volumenM3: carga.volumenTotalM3, ayudantes: carga.ayudantes },
              tarifas(fila),
            )
          : null,
        rating: p.cantidadCalificaciones > 0 ? p.ratingPromedio.toNumber() : null,
        calificaciones: p.cantidadCalificaciones,
        fletesCompletados: completadosPor.get(p.id) ?? 0,
        vehiculos: p.vehiculos,
      },
    ];
  });
}

export type FleteroEncontrado = Awaited<ReturnType<typeof buscarFleteros>>[number];
