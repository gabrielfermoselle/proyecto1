import "server-only";
import type {
  EstadoReclamo,
  EtapaFlete,
  FaseControl,
  ResultadoControl,
  TipoDocumento,
  TipoVehiculo,
} from "@/domain/catalogos";
import { ETAPAS_ACTIVAS } from "@/domain/ciclo-flete";
import { fechaIsoAr, fechaIsoDeDia } from "@/domain/fechas";
import type { Rol } from "@/domain/roles";
import { urlsFirmadas } from "@/features/uploads/storage";
import { db, fallar, numero, relacion } from "@/lib/db";

// Consultas del panel de administración. El admin ve nombres completos y emails: los necesita
// para gestionar cuentas. Nunca contraseñas (ni sus hashes).

const nombreCompleto = (u: { nombre: string; apellido: string }) => `${u.nombre} ${u.apellido}`;

const ETAPAS_SIN_EMPEZAR = ["CONFIRMADO", "EN_CAMINO_A_ORIGEN"] as const;

/** Medianoche UTC del día en Tucumán: lo que ya pasó de esa fecha está demorado o vencido. */
const limiteDia = (hoy = fechaIsoAr()) => `${hoy}T00:00:00.000Z`;

type UnoOVarios<T> = T | T[] | null;

function uno<T>(valor: UnoOVarios<T>): T {
  const fila = relacion(valor);
  if (!fila) throw new Error("Falta un dato relacionado");
  return fila;
}

function lista<T>(valor: T[] | null | undefined): T[] {
  return valor ?? [];
}

const instante = (valor: string) => new Date(valor);
const instanteONull = (valor: string | null) => (valor ? new Date(valor) : null);

function fechaCalendario(valor: string): string {
  return fechaIsoDeDia(new Date(valor.includes("T") ? valor : `${valor}T00:00:00.000Z`));
}

function cuentaRelacion(valor: unknown): number {
  if (typeof valor === "number") return valor;
  if (Array.isArray(valor)) {
    const primero = valor[0] as { count?: unknown } | undefined;
    return primero ? numero(primero.count) : 0;
  }
  if (valor && typeof valor === "object" && "count" in valor) return numero(valor.count);
  return 0;
}

/** `ilike` dentro de un `or`: las comillas evitan que un punto o una coma partan el filtro. */
function ilikeContiene(texto: string): string {
  const literal = texto
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '""')
    .replace(/[%_]/g, (caracter) => `\\${caracter}`);
  return `"%${literal}%"`;
}

async function total(
  consulta: PromiseLike<{ count: number | null; error: Parameters<typeof fallar>[0] }>,
): Promise<number> {
  const { count, error } = await consulta;
  fallar(error);
  return count ?? 0;
}

export async function getResumenAdmin() {
  const limite = limiteDia();
  const [
    clientes,
    fleteros,
    inactivos,
    sinVerificar,
    solicitudesAbiertas,
    fletesActivos,
    demorados,
    reclamosAbiertos,
  ] = await Promise.all([
    total(db().from("usuarios").select("*", { count: "exact", head: true }).eq("rol", "CLIENTE")),
    total(db().from("usuarios").select("*", { count: "exact", head: true }).eq("rol", "FLETERO")),
    total(db().from("usuarios").select("*", { count: "exact", head: true }).eq("activo", false)),
    total(
      db()
        .from("perfiles_fletero")
        .select("*", { count: "exact", head: true })
        .eq("verificado", false)
        .not("onboardingCompletadoEn", "is", null),
    ),
    total(db().from("solicitudes").select("*", { count: "exact", head: true }).eq("estado", "ABIERTA")),
    total(
      db()
        .from("fletes")
        .select("*", { count: "exact", head: true })
        .in("etapa", [...ETAPAS_ACTIVAS]),
    ),
    total(
      db()
        .from("fletes")
        .select("id, solicitudes!inner(fecha)", { count: "exact", head: true })
        .in("etapa", [...ETAPAS_SIN_EMPEZAR])
        .lt("solicitudes.fecha", limite),
    ),
    total(db().from("reclamos").select("*", { count: "exact", head: true }).eq("estado", "ABIERTO")),
  ]);
  return {
    clientes,
    fleteros,
    inactivos,
    sinVerificar,
    solicitudesAbiertas,
    fletesActivos,
    demorados,
    reclamosAbiertos,
  };
}

interface FilaDemorada {
  id: string;
  etapa: EtapaFlete;
  solicitudes: UnoOVarios<{ titulo: string; fecha: string }>;
  perfiles_cliente: UnoOVarios<{ usuarios: UnoOVarios<{ nombre: string; apellido: string; email: string }> }>;
  perfiles_fletero: UnoOVarios<{ usuarios: UnoOVarios<{ nombre: string; apellido: string; email: string }> }>;
}

export async function getFletesDemorados() {
  const { data, error } = await db()
    .from("fletes")
    .select(
      `id, etapa,
      solicitudes!inner (titulo, fecha),
      perfiles_cliente (usuarios (nombre, apellido, email)),
      perfiles_fletero (usuarios (nombre, apellido, email))`,
    )
    .in("etapa", [...ETAPAS_SIN_EMPEZAR])
    .lt("solicitudes.fecha", limiteDia())
    .order("solicitudes(fecha)", { ascending: true })
    .limit(50);
  fallar(error);
  return ((data ?? []) as FilaDemorada[]).map((f) => {
    const solicitud = uno(f.solicitudes);
    const cliente = uno(uno(f.perfiles_cliente).usuarios);
    const fletero = uno(uno(f.perfiles_fletero).usuarios);
    return {
      id: f.id,
      etapa: f.etapa,
      titulo: solicitud.titulo,
      fecha: fechaCalendario(solicitud.fecha),
      cliente: { nombre: nombreCompleto(cliente), email: cliente.email },
      fletero: { nombre: nombreCompleto(fletero), email: fletero.email },
    };
  });
}

export const ROLES_FILTRO = ["CLIENTE", "FLETERO", "ADMIN"] as const;
const POR_PAGINA = 40;

interface FilaUsuario {
  id: string;
  nombre: string;
  apellido: string;
  email: string;
  rol: Rol;
  activo: boolean;
  createdAt: string;
  perfiles_fletero: UnoOVarios<{
    id: string;
    verificado: boolean;
    onboardingCompletadoEn: string | null;
    ratingPromedio: unknown;
    cantidadCalificaciones: number;
  }>;
}

type EstadoSolicitud = "ABIERTA" | "ADJUDICADA" | "CANCELADA" | "VENCIDA";

export async function getUsuarios({ q, rol, pagina }: { q: string; rol: Rol | null; pagina: number }) {
  const texto = q.trim();
  const desde = (pagina - 1) * POR_PAGINA;
  let consulta = db()
    .from("usuarios")
    .select(
      `id, nombre, apellido, email, rol, activo, createdAt,
      perfiles_fletero (id, verificado, onboardingCompletadoEn, ratingPromedio, cantidadCalificaciones)`,
      { count: "exact" },
    )
    .order("createdAt", { ascending: false });
  if (rol) consulta = consulta.eq("rol", rol);
  if (texto) {
    const patron = ilikeContiene(texto);
    consulta = consulta.or(`email.ilike.${patron},nombre.ilike.${patron},apellido.ilike.${patron}`);
  }
  const { data, count, error } = await consulta.range(desde, desde + POR_PAGINA - 1);
  fallar(error);
  const totalFilas = count ?? 0;
  return {
    total: totalFilas,
    paginas: Math.max(1, Math.ceil(totalFilas / POR_PAGINA)),
    usuarios: ((data ?? []) as FilaUsuario[]).map((u) => {
      const fletero = relacion(u.perfiles_fletero);
      const calificaciones = fletero ? numero(fletero.cantidadCalificaciones) : 0;
      return {
        id: u.id,
        nombre: nombreCompleto(u),
        email: u.email,
        rol: u.rol,
        activo: u.activo,
        alta: instante(u.createdAt),
        fletero: fletero
          ? {
              id: fletero.id,
              verificado: fletero.verificado,
              onboardingCompleto: fletero.onboardingCompletadoEn !== null,
              rating: calificaciones > 0 ? numero(fletero.ratingPromedio) : null,
              calificaciones,
            }
          : null,
      };
    }),
  };
}

export type UsuarioAdmin = Awaited<ReturnType<typeof getUsuarios>>["usuarios"][number];

interface FilaReclamo {
  id: string;
  descripcion: string;
  estado: EstadoReclamo;
  createdAt: string;
  resolucion: string | null;
  resueltoEn: string | null;
  usuarios: UnoOVarios<{ nombre: string; apellido: string }>;
  fotos: { id: string; ruta: string; ancho: number | null; alto: number | null }[] | null;
  items_inventario: UnoOVarios<{
    nombre: string;
    cantidad: number;
    controles_item: { fase: FaseControl; resultado: ResultadoControl; observacion: string | null }[] | null;
  }>;
  fletes: UnoOVarios<{
    id: string;
    solicitudes: UnoOVarios<{ titulo: string }>;
    perfiles_cliente: UnoOVarios<{
      usuarios: UnoOVarios<{ nombre: string; apellido: string; email: string }>;
    }>;
    perfiles_fletero: UnoOVarios<{
      usuarios: UnoOVarios<{ nombre: string; apellido: string; email: string }>;
    }>;
  }>;
}

export async function getReclamos(estado: EstadoReclamo) {
  const { data, error } = await db()
    .from("reclamos")
    .select(
      `id, descripcion, estado, createdAt, resolucion, resueltoEn,
      usuarios!reclamos_resueltoPorId_fkey (nombre, apellido),
      fotos (id, ruta, ancho, alto),
      items_inventario (
        nombre, cantidad,
        controles_item (fase, resultado, observacion)
      ),
      fletes (
        id,
        solicitudes (titulo),
        perfiles_cliente (usuarios (nombre, apellido, email)),
        perfiles_fletero (usuarios (nombre, apellido, email))
      )`,
    )
    .eq("estado", estado)
    .order("createdAt", { ascending: estado === "ABIERTO" })
    .limit(50);
  fallar(error);
  const reclamos = (data ?? []) as FilaReclamo[];
  const urls = await urlsFirmadas(reclamos.flatMap((r) => lista(r.fotos).map((f) => f.ruta)));
  return reclamos.map((r) => {
    const item = uno(r.items_inventario);
    const flete = uno(r.fletes);
    const solicitud = uno(flete.solicitudes);
    const cliente = uno(uno(flete.perfiles_cliente).usuarios);
    const fletero = uno(uno(flete.perfiles_fletero).usuarios);
    const resueltoPor = relacion(r.usuarios);
    const cantidad = numero(item.cantidad);
    return {
      id: r.id,
      descripcion: r.descripcion,
      estado: r.estado,
      fecha: instante(r.createdAt),
      resolucion: r.resolucion,
      resueltoEn: instanteONull(r.resueltoEn),
      resueltoPor: resueltoPor ? nombreCompleto(resueltoPor) : null,
      fotos: lista(r.fotos).flatMap(({ ruta, ancho, alto, id }) => {
        const url = urls.get(ruta);
        return url
          ? [
              {
                id,
                ancho: ancho == null ? null : numero(ancho),
                alto: alto == null ? null : numero(alto),
                url,
              },
            ]
          : [];
      }),
      item: `${cantidad > 1 ? `${cantidad} × ` : ""}${item.nombre}`,
      /** Lo que registró el fletero sobre ese ítem: sirve para decidir. */
      controles: lista(item.controles_item),
      fleteId: flete.id,
      titulo: solicitud.titulo,
      cliente: { nombre: nombreCompleto(cliente), email: cliente.email },
      fletero: { nombre: nombreCompleto(fletero), email: fletero.email },
    };
  });
}

export type ReclamoAdmin = Awaited<ReturnType<typeof getReclamos>>[number];

interface FilaSolicitud {
  id: string;
  titulo: string;
  estado: EstadoSolicitud;
  fecha: string;
  createdAt: string;
  perfiles_cliente: UnoOVarios<{ usuarios: UnoOVarios<{ nombre: string; apellido: string }> }>;
  fletes: UnoOVarios<{ id: string; etapa: EtapaFlete }>;
  presupuestos: unknown;
}

export async function getSolicitudesAdmin() {
  const { data, error } = await db()
    .from("solicitudes")
    .select(
      `id, titulo, estado, fecha, createdAt,
      perfiles_cliente (usuarios (nombre, apellido)),
      fletes (id, etapa),
      presupuestos(count)`,
    )
    .order("createdAt", { ascending: false })
    .limit(60);
  fallar(error);
  return ((data ?? []) as FilaSolicitud[]).map((s) => {
    const cliente = uno(uno(s.perfiles_cliente).usuarios);
    const flete = relacion(s.fletes);
    return {
      id: s.id,
      titulo: s.titulo,
      estado: s.estado,
      fecha: fechaCalendario(s.fecha),
      publicada: instante(s.createdAt),
      cliente: nombreCompleto(cliente),
      presupuestos: cuentaRelacion(s.presupuestos),
      flete,
    };
  });
}

interface FilaFletero {
  id: string;
  dni: string | null;
  verificado: boolean;
  onboardingCompletadoEn: string | null;
  ratingPromedio: unknown;
  cantidadCalificaciones: number;
  usuarios: UnoOVarios<{ nombre: string; apellido: string; email: string; telefono: string | null }>;
  vehiculos: { tipo: TipoVehiculo; marca: string; modelo: string; patente: string; activo: boolean }[] | null;
  documentos_fletero: { tipo: TipoDocumento; ruta: string; createdAt: string }[] | null;
}

/**
 * Fleteros con el perfil completo para verificar, con su documentación (URLs firmadas: el bucket
 * es privado). Primero los que tienen más documentos cargados.
 */
export async function getFleterosParaVerificar(verificados: boolean) {
  const { data, error } = await db()
    .from("perfiles_fletero")
    .select(
      `id, dni, verificado, onboardingCompletadoEn, ratingPromedio, cantidadCalificaciones,
      usuarios!inner (nombre, apellido, email, telefono),
      vehiculos (tipo, marca, modelo, patente, activo),
      documentos_fletero (tipo, ruta, createdAt)`,
    )
    .eq("verificado", verificados)
    .not("onboardingCompletadoEn", "is", null)
    .eq("usuarios.activo", true)
    .order("onboardingCompletadoEn", { ascending: false })
    .limit(60);
  fallar(error);
  const fleteros = (data ?? []) as FilaFletero[];
  const urls = await urlsFirmadas(fleteros.flatMap((f) => lista(f.documentos_fletero).map((d) => d.ruta)));
  return fleteros
    .map((f) => {
      const user = uno(f.usuarios);
      const calificaciones = numero(f.cantidadCalificaciones);
      return {
        id: f.id,
        nombre: nombreCompleto(user),
        email: user.email,
        telefono: user.telefono,
        dni: f.dni,
        verificado: f.verificado,
        alta: instanteONull(f.onboardingCompletadoEn),
        rating: calificaciones > 0 ? numero(f.ratingPromedio) : null,
        calificaciones,
        vehiculos: lista(f.vehiculos)
          .filter((v) => v.activo)
          .map(({ tipo, marca, modelo, patente }) => ({ tipo, marca, modelo, patente })),
        documentos: lista(f.documentos_fletero).map((d) => ({
          tipo: d.tipo,
          subidoEn: instante(d.createdAt),
          url: urls.get(d.ruta) ?? null,
        })),
      };
    })
    .sort((a, b) => b.documentos.length - a.documentos.length);
}

export type FleteroParaVerificar = Awaited<ReturnType<typeof getFleterosParaVerificar>>[number];
