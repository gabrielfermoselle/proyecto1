import "server-only";
import type { EstadoPresupuesto, FranjaHoraria, TipoFlete, TipoVehiculo } from "@/domain/catalogos";
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
import { urlsFirmadas } from "@/features/uploads/storage";
import { nombrePublico } from "@/lib/formato";
import { consulta, db, fallar, numero, relacion } from "@/lib/db";
import {
  consultaAccesoSolicitud,
  consultaConteosFeed,
  consultaFeed,
  type FiltrosFeed,
  type FilaFeed,
  type OrdenFeed,
  type TabFeed,
} from "./consultas-sql";

export const POR_PAGINA = 20;

type EstadoSolicitud = "ABIERTA" | "ADJUDICADA" | "CANCELADA" | "VENCIDA";

interface FotoFila {
  id: string;
  ruta: string;
  ancho: number | null;
  alto: number | null;
}

interface ItemFila {
  id: string;
  nombre: string;
  cantidad: number;
  largoCm: number | null;
  anchoCm: number | null;
  altoCm: number | null;
  pesoKgAprox: number | string | null;
  fragil: boolean;
  notas: string | null;
  orden: number;
  fotos: FotoFila[] | null;
}

interface PresupuestoFila {
  id: string;
  fleteroId: string;
  monto: number | string;
  estado: string;
  validoHasta: string;
  mensaje: string | null;
  incluyeAyudantes: number;
  horaLlegada: string | null;
}

interface SolicitudFila {
  id: string;
  titulo: string;
  descripcion: string | null;
  tipoFlete: string;
  estado: string;
  fecha: string;
  franja: string;
  origenDireccion: string;
  origenLat: number;
  origenLng: number;
  origenPiso: number | null;
  origenAscensor: boolean;
  destinoDireccion: string;
  destinoLat: number;
  destinoLng: number;
  destinoPiso: number | null;
  destinoAscensor: boolean;
  distanciaKm: number | string;
  pesoTotalKg: number | string;
  volumenTotalM3: number | string;
  itemsSinMedidas: number;
  ayudantesRequeridos: number;
  requiereEmbalaje: boolean;
  motivoCancelacion: string | null;
  tipoVehiculoSugerido: string | null;
  createdAt: string;
  cliente:
    | { user: { nombre: string; apellido: string } | { nombre: string; apellido: string }[] | null }
    | { user: { nombre: string; apellido: string } | { nombre: string; apellido: string }[] | null }[]
    | null;
  fotos: FotoFila[] | null;
  items: ItemFila[] | null;
  flete: { id: string; fleteroId: string } | { id: string; fleteroId: string }[] | null;
  presupuestos: PresupuestoFila[] | null;
}

async function getVehiculosActivos(fleteroId: string) {
  const { data, error } = await db()
    .from("vehiculos")
    .select("id, tipo, marca, modelo, capacidadKg, volumenM3")
    .eq("fleteroId", fleteroId)
    .eq("activo", true)
    .order("volumenM3", { ascending: true });
  fallar(error);
  return ((data ?? []) as {
    id: string;
    tipo: string;
    marca: string;
    modelo: string;
    capacidadKg: number;
    volumenM3: number | string;
  }[]).map((v) => ({ ...v, tipo: v.tipo as TipoVehiculo, volumenM3: numero(v.volumenM3) }));
}

type VehiculoActivo = Awaited<ReturnType<typeof getVehiculosActivos>>[number];

/** Lo que se muestra de una solicitud antes de la adjudicación: zona, no dirección exacta. */
function aTarjeta(fila: FilaFeed, vehiculos: VehiculoActivo[]) {
  const carga = {
    pesoTotalKg: numero(fila.pesoTotalKg),
    volumenTotalM3: numero(fila.volumenTotalM3),
    itemsSinMedidas: numero(fila.itemsSinMedidas),
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
    ubicacion: aproximarCoordenadas({ lat: numero(fila.origenLat), lng: numero(fila.origenLng) }),
    distanciaBaseKm: numero(fila.distanciaBaseKm),
    recorridoKm: numero(fila.distanciaKm) * FACTOR_RUTA_URBANA,
    ...carga,
    cantidadItems: numero(fila.cantidadItems),
    itemsFragiles: numero(fila.itemsFragiles),
    ayudantesRequeridos: numero(fila.ayudantesRequeridos),
    requiereEmbalaje: fila.requiereEmbalaje,
    presupuestosRecibidos: numero(fila.presupuestosRecibidos),
    miMonto: fila.miMonto == null ? null : numero(fila.miMonto),
    vehiculoSugerido: sugerido ? `${sugerido.marca} ${sugerido.modelo}` : null,
  };
}

export type TarjetaSolicitud = ReturnType<typeof aTarjeta>;

export async function getFeed(
  fleteroId: string,
  opciones: { tab: TabFeed; orden: OrdenFeed; pagina: number; filtros?: FiltrosFeed },
) {
  const hoy = fechaIsoAr();
  const limite = POR_PAGINA * opciones.pagina;
  const feedSql = consultaFeed({
    fleteroId,
    hoy,
    tab: opciones.tab,
    orden: opciones.orden,
    limite: limite + 1,
    ...(opciones.filtros ? { filtros: opciones.filtros } : {}),
  });
  const conteosSql = consultaConteosFeed({ fleteroId, hoy });
  const [filas, conteos, perfil, vehiculos] = await Promise.all([
    consulta<FilaFeed>(feedSql.sql, feedSql.params),
    consulta<{ nuevas: number; presupuestadas: number }>(conteosSql.sql, conteosSql.params),
    (async () => {
      const { data, error } = await db()
        .from("perfiles_fletero")
        .select("disponible, radioCoberturaKm, baseLat, baseLng")
        .eq("id", fleteroId)
        .single();
      fallar(error);
      if (!data) throw new Error("No se encontró el registro");
      return data as {
        disponible: boolean;
        radioCoberturaKm: number;
        baseLat: number | null;
        baseLng: number | null;
      };
    })(),
    getVehiculosActivos(fleteroId),
  ]);
  const conteo = conteos[0];

  return {
    solicitudes: filas.slice(0, limite).map((fila) => aTarjeta(fila, vehiculos)),
    hayMas: filas.length > limite,
    conteos: {
      nuevas: numero(conteo?.nuevas ?? 0),
      presupuestadas: numero(conteo?.presupuestadas ?? 0),
    },
    perfil: {
      disponible: perfil.disponible,
      radioKm: perfil.radioCoberturaKm,
      base:
        perfil.baseLat !== null && perfil.baseLng !== null
          ? { lat: numero(perfil.baseLat), lng: numero(perfil.baseLng) }
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
  const accesoSql = consultaAccesoSolicitud(fleteroId, solicitudId, hoy);
  const [acceso] = await consulta<{ permitido: boolean; distanciaBaseKm: number | null }>(
    accesoSql.sql,
    accesoSql.params,
  );
  if (!acceso?.permitido) return null;

  const [solicitudRaw, perfil, vehiculos, turnos, conversacion] = await Promise.all([
    (async () => {
      const { data, error } = await db()
        .from("solicitudes")
        .select(
          `id, titulo, descripcion, tipoFlete, estado, fecha, franja,
           origenDireccion, origenLat, origenLng, origenPiso, origenAscensor,
           destinoDireccion, destinoLat, destinoLng, destinoPiso, destinoAscensor,
           distanciaKm, pesoTotalKg, volumenTotalM3, itemsSinMedidas, ayudantesRequeridos, requiereEmbalaje,
           motivoCancelacion, tipoVehiculoSugerido, createdAt,
           cliente:perfiles_cliente!solicitudes_clienteId_fkey(user:usuarios!cliente_profiles_userId_fkey(nombre, apellido)),
           fotos!fotos_solicitudId_fkey(id, ruta, ancho, alto),
           items:items_inventario!items_inventario_solicitudId_fkey(id, nombre, cantidad, largoCm, anchoCm, altoCm, pesoKgAprox, fragil, notas, orden, fotos!fotos_itemId_fkey(id, ruta, ancho, alto)),
           flete:fletes!fletes_solicitudId_fkey(id, fleteroId),
           presupuestos!presupuestos_solicitudId_fkey(id, fleteroId, monto, estado, validoHasta, mensaje, incluyeAyudantes, horaLlegada)`,
        )
        .eq("id", solicitudId)
        .single();
      fallar(error);
      if (!data) throw new Error("No se encontró el registro");
      return data as SolicitudFila;
    })(),
    (async () => {
      const { data, error } = await db()
        .from("perfiles_fletero")
        .select("disponible, precioMinimo, precioPorKm, precioPorM3, precioPorAyudante")
        .eq("id", fleteroId)
        .single();
      fallar(error);
      if (!data) throw new Error("No se encontró el registro");
      return data as {
        disponible: boolean;
        precioMinimo: number | string;
        precioPorKm: number | string;
        precioPorM3: number | string;
        precioPorAyudante: number | string;
      };
    })(),
    getVehiculosActivos(fleteroId),
    getTurnosActivos(fleteroId),
    (async () => {
      const { data, error } = await db()
        .from("conversaciones")
        .select("id")
        .eq("solicitudId", solicitudId)
        .eq("fleteroId", fleteroId)
        .maybeSingle();
      fallar(error);
      return data as { id: string } | null;
    })(),
  ]);

  const s = solicitudRaw;
  const flete = relacion(s.flete);
  const clientePerfil = relacion(s.cliente);
  const clienteUser = relacion(clientePerfil?.user ?? null);
  if (!clienteUser) throw new Error("No se encontró el registro");

  const esMiFlete = flete?.fleteroId === fleteroId;
  const ubicar = (direccion: string, punto: Coordenadas) =>
    esMiFlete
      ? { direccion, punto, exacta: true }
      : { direccion: direccionAproximada(direccion), punto: aproximarCoordenadas(punto), exacta: false };

  const carga = {
    pesoTotalKg: numero(s.pesoTotalKg),
    volumenTotalM3: numero(s.volumenTotalM3),
    itemsSinMedidas: s.itemsSinMedidas,
  };
  const tarifas = {
    precioMinimo: numero(perfil.precioMinimo),
    precioPorKm: numero(perfil.precioPorKm),
    precioPorM3: numero(perfil.precioPorM3),
    precioPorAyudante: numero(perfil.precioPorAyudante),
  };
  const fecha = fechaIsoDeDia(new Date(s.fecha));
  const items = [...(s.items ?? [])].sort((a, b) => a.orden - b.orden);
  // Las fotos de la solicitud son privadas: se firman por un rato solo para quien puede verlas.
  const fotos = [...(s.fotos ?? []), ...items.flatMap((i) => i.fotos ?? [])];
  const urlsFotos = await urlsFirmadas(fotos.map((f) => f.ruta));
  const sugerido = vehiculoSugerido(carga, vehiculos);
  const presupuestos = s.presupuestos ?? [];
  const miPresupuesto = presupuestos.find((p) => p.fleteroId === fleteroId);
  const distanciaKm = numero(s.distanciaKm);

  return {
    id: s.id,
    titulo: s.titulo,
    descripcion: s.descripcion,
    tipoFlete: s.tipoFlete as TipoFlete,
    estado: s.estado as EstadoSolicitud,
    fecha,
    franja: s.franja as FranjaHoraria,
    publicadaEn: new Date(s.createdAt),
    cliente: nombrePublico(clienteUser.nombre, clienteUser.apellido),
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
    distanciaLinealKm: distanciaKm,
    recorridoKm: distanciaKm * FACTOR_RUTA_URBANA,
    distanciaBaseKm: numero(acceso.distanciaBaseKm),
    carga,
    ayudantesRequeridos: s.ayudantesRequeridos,
    requiereEmbalaje: s.requiereEmbalaje,
    motivoCancelacion: s.motivoCancelacion,
    tipoVehiculoSugerido: (s.tipoVehiculoSugerido as TipoVehiculo | null) ?? null,
    fotos: fotos.flatMap(({ ruta, ...f }) => {
      const url = urlsFotos.get(ruta);
      return url ? [{ ...f, url }] : [];
    }),
    items: items.map(({ id, nombre, cantidad, largoCm, anchoCm, altoCm, pesoKgAprox, fragil, notas }) => ({
      id,
      nombre,
      cantidad,
      largoCm,
      anchoCm,
      altoCm,
      pesoKgAprox: pesoKgAprox == null ? null : numero(pesoKgAprox),
      fragil,
      notas,
    })),
    presupuestosRecibidos: presupuestos.filter((p) => p.estado === "PENDIENTE").length,
    fleteId: esMiFlete ? (flete?.id ?? null) : null,
    conversacionId: conversacion?.id ?? null,
    miPresupuesto: miPresupuesto
      ? {
          id: miPresupuesto.id,
          monto: numero(miPresupuesto.monto),
          estado: miPresupuesto.estado as EstadoPresupuesto,
          validoHasta: new Date(miPresupuesto.validoHasta),
          mensaje: miPresupuesto.mensaje,
          incluyeAyudantes: miPresupuesto.incluyeAyudantes,
          horaLlegada: miPresupuesto.horaLlegada,
        }
      : null,
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
        distanciaLinealKm: distanciaKm,
        volumenM3: carga.volumenTotalM3,
        ayudantes: s.ayudantesRequeridos,
      },
      tarifas,
    ),
    conflictos: conflictosCon({ fecha, franja: s.franja as FranjaHoraria }, turnos).filter(
      (t) => t.solicitudId !== s.id,
    ),
  };
}

export type SolicitudParaFletero = NonNullable<Awaited<ReturnType<typeof getSolicitudParaFletero>>>;
