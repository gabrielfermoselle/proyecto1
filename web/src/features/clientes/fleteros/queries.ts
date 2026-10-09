import "server-only";
import type { TipoVehiculo } from "@/domain/catalogos";
import { FACTOR_RUTA_URBANA, type Coordenadas } from "@/domain/geo";
import { precioSugerido } from "@/domain/precio";
import { direccionAproximada } from "@/domain/direccion";
import { getDireccionHabitual } from "@/features/clientes/perfil/queries";
import { nombrePublico } from "@/lib/formato";
import { consulta, db, fallar, numero, relacion } from "@/lib/db";
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

interface UsuarioNombre {
  nombre: string;
  apellido: string;
}

interface VehiculoTarjeta {
  tipo: string;
  marca: string;
  modelo: string;
  activo: boolean;
}

interface PerfilTarjeta {
  id: string;
  bio: string | null;
  verificado: boolean;
  disponible: boolean;
  baseDireccion: string | null;
  ratingPromedio: unknown;
  cantidadCalificaciones: number;
  usuarios: UsuarioNombre | UsuarioNombre[] | null;
  vehiculos: VehiculoTarjeta[] | null;
}

function lista<T>(valor: T | T[] | null | undefined): T[] {
  if (valor == null) return [];
  return Array.isArray(valor) ? valor : [valor];
}

function filaBuscador(fila: FilaBuscador): FilaBuscador {
  return {
    id: fila.id,
    distanciaKm: fila.distanciaKm == null ? null : numero(fila.distanciaKm),
    radioCoberturaKm: numero(fila.radioCoberturaKm),
    precioMinimo: numero(fila.precioMinimo),
    precioPorKm: numero(fila.precioPorKm),
    precioPorM3: numero(fila.precioPorM3),
    precioPorAyudante: numero(fila.precioPorAyudante),
  };
}

async function contarFletesCerrados(fleteroIds: string[]): Promise<Map<string, number>> {
  const mapa = new Map<string, number>();
  if (fleteroIds.length === 0) return mapa;
  const { data, error } = await db()
    .from("fletes")
    .select("fleteroId")
    .in("fleteroId", fleteroIds)
    .eq("etapa", "CERRADO");
  fallar(error);
  for (const fila of data ?? []) {
    const id = fila.fleteroId as string;
    mapa.set(id, (mapa.get(id) ?? 0) + 1);
  }
  return mapa;
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
    const { data: s, error } = await db()
      .from("solicitudes")
      .select("titulo, origenLat, origenLng, distanciaKm, pesoTotalKg, volumenTotalM3, ayudantesRequeridos")
      .eq("id", p.solicitud)
      .eq("clienteId", clienteId)
      .eq("estado", "ABIERTA")
      .maybeSingle();
    fallar(error);
    if (s) {
      return {
        tipo: "solicitud",
        punto: { lat: numero(s.origenLat), lng: numero(s.origenLng) },
        etiqueta: s.titulo as string,
        carga: {
          distanciaKm: numero(s.distanciaKm),
          pesoTotalKg: numero(s.pesoTotalKg),
          volumenTotalM3: numero(s.volumenTotalM3),
          ayudantes: s.ayudantesRequeridos as number,
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
export async function getSolicitudesAbiertas(clienteId: string) {
  const { data, error } = await db()
    .from("solicitudes")
    .select("id, titulo")
    .eq("clienteId", clienteId)
    .eq("estado", "ABIERTA")
    .order("fecha", { ascending: true })
    .limit(20);
  fallar(error);
  return (data ?? []) as { id: string; titulo: string }[];
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
  const busqueda = consultaBuscador({
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
  });
  const filas = (await consulta<FilaBuscador>(busqueda.sql, busqueda.params)).map(filaBuscador);
  const ids = filas.map((fila) => fila.id);
  if (ids.length === 0) return [];

  const [perfilesResultado, completadosPor] = await Promise.all([
    db()
      .from("perfiles_fletero")
      .select(
        "id, bio, verificado, disponible, baseDireccion, ratingPromedio, cantidadCalificaciones, usuarios(nombre, apellido), vehiculos(tipo, marca, modelo, activo)",
      )
      .in("id", ids),
    contarFletesCerrados(ids),
  ]);
  fallar(perfilesResultado.error);
  const perfilPor = new Map(
    ((perfilesResultado.data ?? []) as PerfilTarjeta[]).map((perfil) => [perfil.id, perfil]),
  );

  // El orden lo decide la consulta SQL; acá solo se completan los datos de cada tarjeta.
  return filas.flatMap((fila) => {
    const p = perfilPor.get(fila.id);
    if (!p) return [];
    const user = relacion(p.usuarios);
    if (!user) throw new Error("Fletero sin usuario.");
    return [
      {
        id: p.id,
        nombre: nombrePublico(user.nombre, user.apellido),
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
              {
                distanciaLinealKm: carga.distanciaKm,
                volumenM3: carga.volumenTotalM3,
                ayudantes: carga.ayudantes,
              },
              tarifas(fila),
            )
          : null,
        rating: p.cantidadCalificaciones > 0 ? numero(p.ratingPromedio) : null,
        calificaciones: p.cantidadCalificaciones,
        fletesCompletados: completadosPor.get(p.id) ?? 0,
        vehiculos: lista(p.vehiculos)
          .filter((v) => v.activo)
          .map((v) => ({ tipo: v.tipo as TipoVehiculo, marca: v.marca, modelo: v.modelo })),
      },
    ];
  });
}

export type FleteroEncontrado = Awaited<ReturnType<typeof buscarFleteros>>[number];
