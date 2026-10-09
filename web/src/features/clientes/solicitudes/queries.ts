import "server-only";
import type {
  EstadoInicialItem,
  EstadoPresupuesto,
  EtapaFlete,
  FranjaHoraria,
  TipoFlete,
  TipoVehiculo,
} from "@/domain/catalogos";
import { estaVencido } from "@/domain/presupuesto";
import { fechaIsoDeDia } from "@/domain/fechas";
import { urlsFirmadas } from "@/features/uploads/storage";
import { nombrePublico } from "@/lib/formato";
import { db, fallar, numero, relacion } from "@/lib/db";

// Solicitudes del cliente: siempre filtradas por su clienteId (si no es suya, no existe).

type EstadoSolicitud = "ABIERTA" | "ADJUDICADA" | "CANCELADA" | "VENCIDA";

function lista<T>(valor: T | T[] | null | undefined): T[] {
  if (valor == null) return [];
  return Array.isArray(valor) ? valor : [valor];
}

function comoFecha(valor: unknown): Date {
  return valor instanceof Date ? valor : new Date(String(valor));
}

function numeroONull(valor: unknown): number | null {
  if (valor == null) return null;
  return numero(valor);
}

/** Presupuestos vigentes de un pedido abierto: cuántos hay y desde cuánto. */
function resumenPresupuestos(pendientes: { monto: unknown; validoHasta: unknown }[]) {
  const ahora = new Date();
  const vigentes = pendientes
    .filter((p) => !estaVencido(comoFecha(p.validoHasta), ahora))
    .map((p) => numero(p.monto));
  return {
    presupuestosPendientes: vigentes.length,
    presupuestoMinimo: vigentes.length > 0 ? Math.min(...vigentes) : null,
  };
}

interface CalificacionEmbed {
  id: string;
}

interface FleteLista {
  id: string;
  etapa: string;
  precioAcordado: unknown;
  calificaciones: CalificacionEmbed | CalificacionEmbed[] | null;
}

interface PresupuestoLista {
  monto: unknown;
  validoHasta: unknown;
  estado: string;
}

interface SolicitudLista {
  id: string;
  titulo: string;
  tipoFlete: string;
  estado: string;
  fecha: unknown;
  franja: string;
  origenDireccion: string;
  destinoDireccion: string;
  createdAt: unknown;
  distanciaKm: unknown;
  fletes: FleteLista | FleteLista[] | null;
  presupuestos: PresupuestoLista[] | null;
  items_inventario: { id: string }[] | null;
}

export async function getSolicitudesDelCliente(clienteId: string) {
  const { data, error } = await db()
    .from("solicitudes")
    .select(
      `id, titulo, tipoFlete, estado, fecha, franja, origenDireccion, destinoDireccion, createdAt, distanciaKm,
       fletes(id, etapa, precioAcordado, calificaciones(id)),
       presupuestos(monto, validoHasta, estado),
       items_inventario(id)`,
    )
    .eq("clienteId", clienteId)
    .order("fecha", { ascending: true })
    .order("createdAt", { ascending: false })
    .limit(60);
  fallar(error);

  return ((data ?? []) as SolicitudLista[]).map((s) => {
    const flete = relacion(s.fletes);
    const pendientes = lista(s.presupuestos).filter((p) => p.estado === "PENDIENTE");
    return {
      id: s.id,
      titulo: s.titulo,
      tipoFlete: s.tipoFlete as TipoFlete,
      estado: s.estado as EstadoSolicitud,
      fecha: fechaIsoDeDia(comoFecha(s.fecha)),
      franja: s.franja as FranjaHoraria,
      origen: s.origenDireccion,
      destino: s.destinoDireccion,
      distanciaKm: numero(s.distanciaKm),
      items: lista(s.items_inventario).length,
      ...resumenPresupuestos(pendientes),
      flete: flete
        ? {
            id: flete.id,
            etapa: flete.etapa as EtapaFlete,
            precioAcordado: numero(flete.precioAcordado),
            calificado: relacion(flete.calificaciones) !== null,
          }
        : null,
    };
  });
}

export type SolicitudDeLista = Awaited<ReturnType<typeof getSolicitudesDelCliente>>[number];

interface FotoFila {
  id: string;
  ruta: string;
  ancho: number | null;
  alto: number | null;
}

interface UsuarioNombre {
  nombre: string;
  apellido: string;
}

interface FleteroPresupuesto {
  id: string;
  verificado: boolean;
  ratingPromedio: unknown;
  cantidadCalificaciones: number;
  usuarios: UsuarioNombre | UsuarioNombre[] | null;
}

interface VehiculoPresupuesto {
  tipo: string;
  marca: string;
  modelo: string;
}

interface ItemDetalle {
  id: string;
  nombre: string;
  cantidad: number;
  largoCm: number | null;
  anchoCm: number | null;
  altoCm: number | null;
  pesoKgAprox: unknown;
  fragil: boolean;
  notas: string | null;
  estadoInicial: string;
  orden: number;
  fotos: FotoFila[] | null;
}

interface PresupuestoDetalle {
  id: string;
  monto: unknown;
  estado: string;
  validoHasta: unknown;
  mensaje: string | null;
  incluyeAyudantes: number;
  horaLlegada: string | null;
  createdAt: unknown;
  vehiculos: VehiculoPresupuesto | VehiculoPresupuesto[] | null;
  perfiles_fletero: FleteroPresupuesto | FleteroPresupuesto[] | null;
}

interface SolicitudDetalle {
  id: string;
  titulo: string;
  descripcion: string | null;
  tipoFlete: string;
  estado: string;
  fecha: unknown;
  franja: string;
  origenDireccion: string;
  origenLat: unknown;
  origenLng: unknown;
  origenPiso: number | null;
  origenAscensor: boolean;
  destinoDireccion: string;
  destinoLat: unknown;
  destinoLng: unknown;
  destinoPiso: number | null;
  destinoAscensor: boolean;
  distanciaKm: unknown;
  pesoTotalKg: unknown;
  volumenTotalM3: unknown;
  itemsSinMedidas: number;
  ayudantesRequeridos: number;
  requiereEmbalaje: boolean;
  motivoCancelacion: string | null;
  tipoVehiculoSugerido: string | null;
  createdAt: unknown;
  fotos: FotoFila[] | null;
  items_inventario: ItemDetalle[] | null;
  fletes: { id: string; etapa: string } | { id: string; etapa: string }[] | null;
  presupuestos: PresupuestoDetalle[] | null;
}

const SELECT_DETALLE = `
  id, titulo, descripcion, tipoFlete, estado, fecha, franja,
  origenDireccion, origenLat, origenLng, origenPiso, origenAscensor,
  destinoDireccion, destinoLat, destinoLng, destinoPiso, destinoAscensor,
  distanciaKm, pesoTotalKg, volumenTotalM3, itemsSinMedidas,
  ayudantesRequeridos, requiereEmbalaje, motivoCancelacion, tipoVehiculoSugerido, createdAt,
  fotos(id, ruta, ancho, alto),
  items_inventario(
    id, nombre, cantidad, largoCm, anchoCm, altoCm, pesoKgAprox, fragil, notas, estadoInicial, orden,
    fotos(id, ruta, ancho, alto)
  ),
  fletes(id, etapa),
  presupuestos(
    id, monto, estado, validoHasta, mensaje, incluyeAyudantes, horaLlegada, createdAt,
    vehiculos(tipo, marca, modelo),
    perfiles_fletero(id, verificado, ratingPromedio, cantidadCalificaciones, usuarios(nombre, apellido))
  )
`;

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

export async function getSolicitudDelCliente(clienteId: string, solicitudId: string) {
  const { data, error } = await db()
    .from("solicitudes")
    .select(SELECT_DETALLE)
    .eq("id", solicitudId)
    .eq("clienteId", clienteId)
    .maybeSingle();
  fallar(error);
  if (!data) return null;
  const s = data as unknown as SolicitudDetalle;

  const items = lista(s.items_inventario).sort((a, b) => a.orden - b.orden);
  const presupuestos = lista(s.presupuestos).sort(
    (a, b) => comoFecha(a.createdAt).getTime() - comoFecha(b.createdAt).getTime(),
  );
  const fleteroIds = [
    ...new Set(
      presupuestos.flatMap((p) => {
        const fletero = relacion(p.perfiles_fletero);
        return fletero ? [fletero.id] : [];
      }),
    ),
  ];
  const [completadosPor, conversacionesResultado] = await Promise.all([
    contarFletesCerrados(fleteroIds),
    fleteroIds.length === 0
      ? Promise.resolve({ data: [] as { id: string; fleteroId: string }[], error: null })
      : db()
          .from("conversaciones")
          .select("id, fleteroId")
          .eq("solicitudId", solicitudId)
          .in("fleteroId", fleteroIds),
  ]);
  fallar(conversacionesResultado.error);
  const conversacionPor = new Map(
    (conversacionesResultado.data ?? []).map((c) => [c.fleteroId as string, c.id as string]),
  );

  const todas: FotoFila[] = [...lista(s.fotos), ...items.flatMap((i) => lista(i.fotos))];
  const urls = await urlsFirmadas(todas.map((f) => f.ruta));
  const fotos = (filas: FotoFila[]) =>
    filas.flatMap(({ ruta, ...f }) => {
      const url = urls.get(ruta);
      return url ? [{ ...f, url }] : [];
    });

  const ahora = new Date();
  const flete = relacion(s.fletes);
  return {
    id: s.id,
    titulo: s.titulo,
    descripcion: s.descripcion,
    tipoFlete: s.tipoFlete as TipoFlete,
    estado: s.estado as EstadoSolicitud,
    fecha: fechaIsoDeDia(comoFecha(s.fecha)),
    franja: s.franja as FranjaHoraria,
    publicadaEn: comoFecha(s.createdAt),
    origen: {
      direccion: s.origenDireccion,
      lat: numero(s.origenLat),
      lng: numero(s.origenLng),
      piso: s.origenPiso,
      ascensor: s.origenAscensor,
    },
    destino: {
      direccion: s.destinoDireccion,
      lat: numero(s.destinoLat),
      lng: numero(s.destinoLng),
      piso: s.destinoPiso,
      ascensor: s.destinoAscensor,
    },
    distanciaKm: numero(s.distanciaKm),
    carga: {
      pesoTotalKg: numero(s.pesoTotalKg),
      volumenTotalM3: numero(s.volumenTotalM3),
      itemsSinMedidas: s.itemsSinMedidas,
    },
    ayudantesRequeridos: s.ayudantesRequeridos,
    requiereEmbalaje: s.requiereEmbalaje,
    motivoCancelacion: s.motivoCancelacion,
    tipoVehiculoSugerido: (s.tipoVehiculoSugerido as TipoVehiculo | null) ?? null,
    fotos: fotos(lista(s.fotos)),
    items: items.map((i) => ({
      id: i.id,
      nombre: i.nombre,
      cantidad: i.cantidad,
      medidas: i.largoCm && i.anchoCm && i.altoCm ? `${i.largoCm} × ${i.anchoCm} × ${i.altoCm} cm` : null,
      pesoKgAprox: numeroONull(i.pesoKgAprox),
      fragil: i.fragil,
      notas: i.notas,
      estadoInicial: i.estadoInicial as EstadoInicialItem,
      fotos: fotos(lista(i.fotos)),
    })),
    flete: flete ? { id: flete.id, etapa: flete.etapa as EtapaFlete } : null,
    presupuestos: presupuestos.map((p) => {
      const vehiculo = relacion(p.vehiculos);
      const fletero = relacion(p.perfiles_fletero);
      const user = fletero ? relacion(fletero.usuarios) : null;
      if (!vehiculo || !fletero || !user) throw new Error("Presupuesto sin vehículo o fletero.");
      return {
        id: p.id,
        monto: numero(p.monto),
        estado: p.estado as EstadoPresupuesto,
        vencido: p.estado === "PENDIENTE" && estaVencido(comoFecha(p.validoHasta), ahora),
        validoHasta: comoFecha(p.validoHasta),
        mensaje: p.mensaje,
        ayudantes: p.incluyeAyudantes,
        horaLlegada: p.horaLlegada,
        vehiculo: { tipo: vehiculo.tipo as TipoVehiculo, marca: vehiculo.marca, modelo: vehiculo.modelo },
        fletero: {
          id: fletero.id,
          nombre: nombrePublico(user.nombre, user.apellido),
          verificado: fletero.verificado,
        },
        rating: fletero.cantidadCalificaciones > 0 ? numero(fletero.ratingPromedio) : null,
        calificaciones: fletero.cantidadCalificaciones,
        fletesCompletados: completadosPor.get(fletero.id) ?? 0,
        conversacionId: conversacionPor.get(fletero.id) ?? null,
      };
    }),
  };
}

export type SolicitudDelCliente = NonNullable<Awaited<ReturnType<typeof getSolicitudDelCliente>>>;
export type PresupuestoRecibido = SolicitudDelCliente["presupuestos"][number];
