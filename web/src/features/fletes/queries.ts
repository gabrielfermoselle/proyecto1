import "server-only";
import { contactoVisible } from "@/domain/chat";
import type {
  EstadoInicialItem,
  EtapaFlete,
  FaseControl,
  FranjaHoraria,
  ResultadoControl,
  TipoFlete,
  TipoVehiculo,
} from "@/domain/catalogos";
import {
  esEtapaEnMovimiento,
  pasosDelCiclo,
  resumenInventario,
  type EtapaCiclo,
  type ResumenInventario,
} from "@/domain/ciclo-flete";
import { fechaIsoDeDia } from "@/domain/fechas";
import { perfilChat } from "@/features/chat/acceso";
import type { RolChat } from "@/features/chat/dto";
import { urlsFirmadas } from "@/features/uploads/storage";
import { db, fallar, numero, relacion } from "@/lib/db";
import { nombrePublico } from "@/lib/formato";
import type { Rol } from "@/domain/roles";
import type { UsuarioActual } from "@/lib/session";
import { aItemControlado, controlesPorFase } from "./inventario";

// Detalle de un flete para cualquiera de sus participantes: lo usan la gestión del fletero,
// el seguimiento del cliente y el comprobante PDF. Si no participa, el flete "no existe".

export interface FotoDto {
  id: string;
  url: string;
  ancho: number | null;
  alto: number | null;
}

export interface ControlDto {
  resultado: ResultadoControl;
  observacion: string | null;
  fecha: Date;
  fotos: FotoDto[];
}

export interface ItemDto {
  id: string;
  nombre: string;
  cantidad: number;
  fragil: boolean;
  notas: string | null;
  estadoInicial: EstadoInicialItem;
  fotos: FotoDto[];
  carga: ControlDto | null;
  descarga: ControlDto | null;
  recepcion: ControlDto | null;
  reclamo: {
    descripcion: string;
    estado: string;
    fecha: Date;
    fotos: FotoDto[];
    resolucion: string | null;
    resueltoEn: Date | null;
  } | null;
}

interface FotoFila {
  id: string;
  ruta: string;
  ancho: number | null;
  alto: number | null;
}

interface UsuarioFila {
  nombre: string;
  apellido: string;
  telefono?: string | null;
  rol?: Rol;
}

const comoRol = (rol: Rol): RolChat => (rol === "CLIENTE" ? "CLIENTE" : "FLETERO");

function comoFecha(valor: unknown): Date {
  if (valor instanceof Date) return valor;
  const texto = String(valor);
  return new Date(/^\d{4}-\d{2}-\d{2}$/.test(texto) ? `${texto}T00:00:00.000Z` : texto);
}

function comoFechaONull(valor: unknown): Date | null {
  return valor == null ? null : comoFecha(valor);
}

function lista<T>(valor: T | T[] | null | undefined): T[] {
  if (valor == null) return [];
  return Array.isArray(valor) ? valor : [valor];
}

function usuarioDe(valor: unknown): UsuarioFila | null {
  return relacion(valor as UsuarioFila | UsuarioFila[] | null);
}

const SELECT_FLETE = `
  id, etapa, precioAcordado, createdAt, fleteroId,
  vehiculo:vehiculos!fletes_vehiculoId_fkey(marca, modelo, tipo, patente),
  presupuesto:presupuestos!fletes_presupuestoId_fkey(incluyeAyudantes),
  calificacion:calificaciones!calificaciones_fleteId_fkey(puntaje, comentario, createdAt),
  fletero:perfiles_fletero!fletes_fleteroId_fkey(user:usuarios!fletero_profiles_userId_fkey(nombre, apellido, telefono)),
  historial:estados_flete!estados_flete_fleteId_fkey(id, etapa, createdAt, nota, lat, lng, precisionM, autor:usuarios!estados_flete_autorId_fkey(rol)),
  conformidades!conformidades_fleteId_fkey(rol, texto, aceptadaEn, user:usuarios!conformidades_userId_fkey(nombre, apellido)),
  controles:controles_item!controles_item_fleteId_fkey(itemId, fase, resultado, observacion, updatedAt, fotos!fotos_controlId_fkey(id, ruta, ancho, alto)),
  reclamos!reclamos_fleteId_fkey(itemId, descripcion, estado, createdAt, resolucion, resueltoEn, fotos!fotos_reclamoId_fkey(id, ruta, ancho, alto)),
  solicitud:solicitudes!fletes_solicitudId_fkey(
    id, titulo, descripcion, tipoFlete, fecha, franja, createdAt,
    origenDireccion, origenLat, origenLng, origenPiso, origenAscensor,
    destinoDireccion, destinoLat, destinoLng, destinoPiso, destinoAscensor,
    cliente:perfiles_cliente!solicitudes_clienteId_fkey(user:usuarios!cliente_profiles_userId_fkey(nombre, apellido, telefono)),
    items:items_inventario!items_inventario_solicitudId_fkey(
      id, nombre, cantidad, fragil, notas, estadoInicial, orden,
      fotos!fotos_itemId_fkey(id, ruta, ancho, alto)
    )
  )
`;

/**
 * Detalle del flete para una de sus partes, por su id o por el de su solicitud (así la página del
 * pedido lo pide en paralelo con la solicitud). `null` si no existe o no participa.
 */
export async function getFleteDetalle(
  ref: string | { solicitudId: string },
  usuario: UsuarioActual,
  { firmarFotos = true }: { firmarFotos?: boolean } = {},
) {
  const perfil = perfilChat(usuario);
  if (!perfil) return null;
  const columna = perfil.rol === "CLIENTE" ? "clienteId" : "fleteroId";
  let q = db().from("fletes").select(SELECT_FLETE).eq(columna, perfil.perfilId);
  q = typeof ref === "string" ? q.eq("id", ref) : q.eq("solicitudId", ref.solicitudId);
  const { data: f, error } = await q.maybeSingle();
  fallar(error);
  if (!f) return null;

  const s = relacion(f.solicitud as Record<string, unknown> | Record<string, unknown>[] | null);
  const vehiculo = relacion(
    f.vehiculo as
      | { marca: string; modelo: string; tipo: TipoVehiculo; patente: string }
      | { marca: string; modelo: string; tipo: TipoVehiculo; patente: string }[]
      | null,
  );
  const presupuesto = relacion(f.presupuesto as { incluyeAyudantes: number } | { incluyeAyudantes: number }[] | null);
  const fleteroPerfil = relacion(f.fletero as { user: unknown } | { user: unknown }[] | null);
  const clientePerfil = s
    ? relacion(s.cliente as { user: unknown } | { user: unknown }[] | null)
    : null;
  const fleteroUser = usuarioDe(fleteroPerfil?.user);
  const clienteUser = usuarioDe(clientePerfil?.user);
  if (!s || !vehiculo || !presupuesto || !fleteroUser || !clienteUser) return null;

  const historialFilas = lista(f.historial as Record<string, unknown>[] | null).sort((a, b) =>
    String(a.createdAt).localeCompare(String(b.createdAt)),
  );
  const conformidadFilas = lista(f.conformidades as Record<string, unknown>[] | null).sort((a, b) =>
    String(a.aceptadaEn).localeCompare(String(b.aceptadaEn)),
  );
  const controles = lista(f.controles as Record<string, unknown>[] | null);
  const reclamos = lista(f.reclamos as Record<string, unknown>[] | null);
  const itemsFilas = lista(s.items as Record<string, unknown>[] | null).sort(
    (a, b) => Number(a.orden) - Number(b.orden),
  );

  const [primerPresupuesto, conversacion] = await Promise.all([
    db()
      .from("presupuestos")
      .select("createdAt")
      .eq("solicitudId", s.id as string)
      .order("createdAt", { ascending: true })
      .limit(1)
      .maybeSingle(),
    db()
      .from("conversaciones")
      .select("id")
      .eq("solicitudId", s.id as string)
      .eq("fleteroId", f.fleteroId as string)
      .maybeSingle(),
  ]);
  fallar(primerPresupuesto.error);
  fallar(conversacion.error);

  const fotosDe = (fila: Record<string, unknown>) => lista(fila.fotos as FotoFila[] | FotoFila | null);
  const todasLasFotos: FotoFila[] = [
    ...itemsFilas.flatMap(fotosDe),
    ...controles.flatMap(fotosDe),
    ...reclamos.flatMap(fotosDe),
  ];
  const urls = firmarFotos ? await urlsFirmadas(todasLasFotos.map((x) => x.ruta)) : new Map<string, string>();
  const fotos = (filas: FotoFila[]): FotoDto[] =>
    filas.flatMap(({ ruta, ...x }) => {
      const url = urls.get(ruta);
      return url ? [{ ...x, url }] : [];
    });

  const controlesDe = (itemId: unknown) =>
    controles
      .filter((c) => c.itemId === itemId)
      .map((c) => ({
        fase: c.fase as FaseControl,
        resultado: c.resultado as ResultadoControl,
        observacion: (c.observacion as string | null) ?? null,
        updatedAt: c.updatedAt,
        fotos: fotosDe(c),
      }));
  const items: ItemDto[] = itemsFilas.map((i) => {
    const propios = controlesDe(i.id);
    const porFase = controlesPorFase(propios);
    const dto = (c: (typeof propios)[number] | null): ControlDto | null =>
      c
        ? {
            resultado: c.resultado,
            observacion: c.observacion,
            fecha: comoFecha(c.updatedAt),
            fotos: fotos(c.fotos),
          }
        : null;
    const reclamo = reclamos.find((r) => r.itemId === i.id) ?? null;
    return {
      id: i.id as string,
      nombre: i.nombre as string,
      cantidad: Number(i.cantidad),
      fragil: Boolean(i.fragil),
      notas: (i.notas as string | null) ?? null,
      estadoInicial: i.estadoInicial as EstadoInicialItem,
      fotos: fotos(fotosDe(i)),
      carga: dto(porFase.carga),
      descarga: dto(porFase.descarga),
      recepcion: dto(porFase.recepcion),
      reclamo: reclamo
        ? {
            descripcion: reclamo.descripcion as string,
            estado: reclamo.estado as string,
            fecha: comoFecha(reclamo.createdAt),
            fotos: fotos(fotosDe(reclamo)),
            resolucion: (reclamo.resolucion as string | null) ?? null,
            resueltoEn: comoFechaONull(reclamo.resueltoEn),
          }
        : null,
    };
  });
  const resumen: ResumenInventario = resumenInventario(
    itemsFilas.map((i) => aItemControlado(i.id as string, controlesDe(i.id))),
  );

  const etapa = f.etapa as EtapaFlete;
  const fechas: Partial<Record<EtapaCiclo, Date>> = { SOLICITADO: comoFecha(s.createdAt) };
  if (primerPresupuesto.data) fechas.PRESUPUESTADO = comoFecha(primerPresupuesto.data.createdAt);
  for (const h of historialFilas) fechas[h.etapa as EtapaCiclo] ??= comoFecha(h.createdAt);

  const historial = historialFilas.map((h) => {
    const autor = usuarioDe(h.autor);
    const lat = h.lat == null ? null : numero(h.lat);
    const lng = h.lng == null ? null : numero(h.lng);
    return {
      id: h.id as string,
      etapa: h.etapa as EtapaFlete,
      fecha: comoFecha(h.createdAt),
      nota: (h.nota as string | null) ?? null,
      porRol: comoRol(autor?.rol ?? "FLETERO"),
      ubicacion: lat !== null && lng !== null ? { lat, lng, precisionM: h.precisionM == null ? null : numero(h.precisionM) } : null,
    };
  });
  const ultimaConUbicacion = historial.findLast((h) => h.ubicacion);
  const cancelacion = historial.find((h) => h.etapa === "CANCELADO") ?? null;

  const cliente = nombrePublico(clienteUser.nombre, clienteUser.apellido);
  const fletero = nombrePublico(fleteroUser.nombre, fleteroUser.apellido);
  const calificacion = relacion(
    f.calificacion as
      | { puntaje: number; comentario: string | null; createdAt: string }
      | { puntaje: number; comentario: string | null; createdAt: string }[]
      | null,
  );

  return {
    id: f.id as string,
    etapa,
    miRol: perfil.rol,
    fleteroId: f.fleteroId as string,
    cliente,
    fletero,
    contraparte: perfil.rol === "CLIENTE" ? fletero : cliente,
    /** Con el flete confirmado (y no cancelado) las partes pueden hablar por WhatsApp o teléfono. */
    telefonoContraparte: contactoVisible(etapa)
      ? ((perfil.rol === "CLIENTE" ? fleteroUser.telefono : clienteUser.telefono) ?? null)
      : null,
    solicitudId: s.id as string,
    titulo: s.titulo as string,
    descripcion: (s.descripcion as string | null) ?? null,
    tipoFlete: s.tipoFlete as TipoFlete,
    fecha: fechaIsoDeDia(comoFecha(s.fecha)),
    franja: s.franja as FranjaHoraria,
    confirmadoEn: comoFecha(f.createdAt),
    precioAcordado: numero(f.precioAcordado),
    vehiculo,
    ayudantes: Number(presupuesto.incluyeAyudantes),
    origen: {
      direccion: s.origenDireccion as string,
      lat: numero(s.origenLat),
      lng: numero(s.origenLng),
      piso: s.origenPiso == null ? null : Number(s.origenPiso),
      ascensor: Boolean(s.origenAscensor),
    },
    destino: {
      direccion: s.destinoDireccion as string,
      lat: numero(s.destinoLat),
      lng: numero(s.destinoLng),
      piso: s.destinoPiso == null ? null : Number(s.destinoPiso),
      ascensor: Boolean(s.destinoAscensor),
    },
    pasos: pasosDelCiclo(etapa, fechas),
    historial,
    /** Solo mientras el fletero está en la calle: después no hace falta saber dónde está. */
    ultimaUbicacion:
      esEtapaEnMovimiento(etapa) && ultimaConUbicacion?.ubicacion
        ? { ...ultimaConUbicacion.ubicacion, fecha: ultimaConUbicacion.fecha }
        : null,
    cancelacion: cancelacion
      ? { fecha: cancelacion.fecha, nota: cancelacion.nota, porRol: cancelacion.porRol }
      : null,
    items,
    resumen,
    conformidades: conformidadFilas.map((c) => {
      const user = usuarioDe(c.user);
      return {
        rol: comoRol((c.rol as Rol) ?? "CLIENTE"),
        texto: c.texto as string,
        aceptadaEn: comoFecha(c.aceptadaEn),
        nombre: nombrePublico(user?.nombre ?? "", user?.apellido ?? ""),
      };
    }),
    calificacion: calificacion
      ? { puntaje: Number(calificacion.puntaje), comentario: calificacion.comentario, createdAt: comoFecha(calificacion.createdAt) }
      : null,
    conversacionId: (conversacion.data?.id as string | undefined) ?? null,
  };
}

export type FleteDetalle = NonNullable<Awaited<ReturnType<typeof getFleteDetalle>>>;

/** Fletes del cliente para su inicio: los en curso primero, después los últimos terminados. */
export async function getFletesDelCliente(clienteId: string) {
  const { data, error } = await db()
    .from("fletes")
    .select(
      `id, etapa, precioAcordado,
       calificacion:calificaciones!calificaciones_fleteId_fkey(id),
       fletero:perfiles_fletero!fletes_fleteroId_fkey(user:usuarios!fletero_profiles_userId_fkey(nombre, apellido)),
       solicitud:solicitudes!fletes_solicitudId_fkey(titulo, fecha, franja, origenDireccion, destinoDireccion)`,
    )
    .eq("clienteId", clienteId)
    .order("createdAt", { ascending: false })
    .limit(30);
  fallar(error);
  return (data ?? []).map((f) => {
    const solicitud = relacion(
      f.solicitud as
        | { titulo: string; fecha: string; franja: FranjaHoraria; origenDireccion: string; destinoDireccion: string }
        | { titulo: string; fecha: string; franja: FranjaHoraria; origenDireccion: string; destinoDireccion: string }[]
        | null,
    );
    const fletero = relacion(f.fletero as { user: unknown } | { user: unknown }[] | null);
    const user = usuarioDe(fletero?.user);
    return {
      id: f.id as string,
      etapa: f.etapa as EtapaFlete,
      precioAcordado: numero(f.precioAcordado),
      calificado: relacion(f.calificacion as { id: string } | { id: string }[] | null) !== null,
      fletero: nombrePublico(user?.nombre ?? "", user?.apellido ?? ""),
      titulo: solicitud?.titulo ?? "",
      fecha: fechaIsoDeDia(comoFecha(solicitud?.fecha ?? "1970-01-01")),
      franja: (solicitud?.franja ?? "FLEXIBLE") as FranjaHoraria,
      origen: solicitud?.origenDireccion ?? "",
      destino: solicitud?.destinoDireccion ?? "",
    };
  });
}
