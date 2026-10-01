import { nanoid } from "nanoid";
import { db } from "../db.js";
import { haversineKm } from "../geo.js";
import { fleteroCard, fleteroByUsuario, nombreUsuario, round1 } from "../helpers.js";
import { TIPOS_CARGA, TIPOS_VEHICULO } from "../constants.js";

// Solicitud de flete:
// { id, clienteId, titulo, tipoCarga, descripcion,
//   origenDireccion, origenLat, origenLng, destinoDireccion, destinoLat, destinoLng,
//   fecha, tipoVehiculo, fotos[], inventario[], estado, fleteroId, presupuestoId,
//   precioAcordado, historial[], creadoEn, completadaEn }
//
// Ítem de inventario: { id, nombre, cantidad, fotoUrl, cargado, cargadoEn, entregado, entregadoEn }
// Presupuesto: { id, solicitudId, fleteroId, monto, mensaje, estado: pendiente|aceptado|rechazado, creadoEn }

const MAX_FOTOS = 6;
const MAX_ITEMS = 50;

export function findSolicitud(id) {
  return db.solicitudes.find((s) => s.id === id) || null;
}

export function fleteroUsuarioId(fleteroId) {
  const fletero = db.fleteros.find((f) => f.id === fleteroId);
  return fletero ? fletero.usuarioId : null;
}

export function presupuestosDe(solicitudId) {
  return db.presupuestos.filter((p) => p.solicitudId === solicitudId);
}

export function registrarEstado(solicitud, estado, usuarioId) {
  solicitud.estado = estado;
  solicitud.historial = [
    ...(solicitud.historial || []),
    { estado, fecha: new Date().toISOString(), usuarioId }
  ];
}

// Quién puede ver una solicitud: su cliente; cualquier fletero mientras está publicada
// (para poder presupuestar); y después, solo el fletero asignado o los que cotizaron.
export function puedeVer(usuario, solicitud) {
  if (solicitud.clienteId === usuario.id) return true;
  if (usuario.rol !== "fletero") return false;
  const fletero = fleteroByUsuario(usuario.id);
  if (!fletero) return false;
  if (solicitud.estado === "publicada") return true;
  return (
    solicitud.fleteroId === fletero.id ||
    presupuestosDe(solicitud.id).some((p) => p.fleteroId === fletero.id)
  );
}

// Chat privado cliente ↔ fletero, por solicitud. Solo se habilita con fleteros que
// enviaron presupuesto o que quedaron asignados (evita mensajes no solicitados).
export function puedeChatear(usuarioId, solicitudId, fleteroId) {
  const solicitud = findSolicitud(solicitudId);
  if (!solicitud) return false;
  const participa =
    solicitud.fleteroId === fleteroId ||
    presupuestosDe(solicitud.id).some((p) => p.fleteroId === fleteroId);
  if (!participa) return false;
  return usuarioId === solicitud.clienteId || usuarioId === fleteroUsuarioId(fleteroId);
}

function distanciaRecorrido(s) {
  if ([s.origenLat, s.origenLng, s.destinoLat, s.destinoLng].some((v) => v == null)) return null;
  return round1(haversineKm(s.origenLat, s.origenLng, s.destinoLat, s.destinoLng));
}

// Versión liviana para listados (sin fotos).
export function resumenSolicitud(s, usuario) {
  const presupuestos = presupuestosDe(s.id);
  const fletero = usuario?.rol === "fletero" ? fleteroByUsuario(usuario.id) : null;
  const mio = fletero ? presupuestos.find((p) => p.fleteroId === fletero.id) : null;
  return {
    id: s.id,
    clienteId: s.clienteId,
    clienteNombre: nombreUsuario(s.clienteId, "Cliente"),
    titulo: s.titulo,
    tipoCarga: s.tipoCarga,
    origenDireccion: s.origenDireccion,
    origenLat: s.origenLat,
    origenLng: s.origenLng,
    destinoDireccion: s.destinoDireccion,
    destinoLat: s.destinoLat,
    destinoLng: s.destinoLng,
    fecha: s.fecha,
    tipoVehiculo: s.tipoVehiculo,
    estado: s.estado,
    fleteroId: s.fleteroId,
    fleteroNombre: s.fleteroId ? nombreUsuario(fleteroUsuarioId(s.fleteroId), "Fletero") : null,
    precioAcordado: s.precioAcordado,
    cantidadItems: (s.inventario || []).reduce((sum, i) => sum + (i.cantidad || 0), 0),
    cantidadPresupuestos: presupuestos.length,
    miPresupuesto: mio || null,
    distanciaRecorridoKm: distanciaRecorrido(s),
    creadoEn: s.creadoEn
  };
}

// Vista completa para el detalle. El cliente ve todos los presupuestos (para comparar);
// cada fletero ve únicamente el suyo.
export function vistaSolicitud(s, usuario) {
  const esCliente = s.clienteId === usuario.id;
  const fletero = usuario.rol === "fletero" ? fleteroByUsuario(usuario.id) : null;
  const presupuestos = presupuestosDe(s.id)
    .filter((p) => esCliente || (fletero && p.fleteroId === fletero.id))
    .map((p) => {
      const f = db.fleteros.find((x) => x.id === p.fleteroId);
      return { ...p, fletero: f ? fleteroCard(f) : null };
    })
    .sort((a, b) => a.monto - b.monto);
  return {
    ...resumenSolicitud(s, usuario),
    descripcion: s.descripcion,
    fotos: s.fotos || [],
    inventario: s.inventario || [],
    historial: s.historial || [],
    presupuestoId: s.presupuestoId,
    fleteroUsuarioId: s.fleteroId ? fleteroUsuarioId(s.fleteroId) : null,
    completadaEn: s.completadaEn,
    resenada: db.resenas.some((r) => r.solicitudId === s.id),
    presupuestos,
    esCliente,
    esFleteroAsignado: Boolean(fletero && s.fleteroId === fletero.id),
    miFleteroId: fletero ? fletero.id : null
  };
}

function parsePunto(value) {
  const n = Number(value);
  return value === "" || value == null || Number.isNaN(n) ? null : n;
}

function parseFotos(fotos) {
  if (!Array.isArray(fotos)) return [];
  return fotos.filter((f) => typeof f === "string" && f).slice(0, MAX_FOTOS);
}

function parseInventario(items, previo = []) {
  if (!Array.isArray(items)) return { error: "El inventario debe ser una lista" };
  if (items.length > MAX_ITEMS) return { error: `El inventario admite hasta ${MAX_ITEMS} ítems` };
  const out = [];
  for (const item of items) {
    const nombre = String(item?.nombre || "").trim();
    if (!nombre) return { error: "Cada ítem del inventario necesita un nombre" };
    const cantidad = Math.trunc(Number(item.cantidad) || 1);
    if (cantidad < 1) return { error: "La cantidad de cada ítem debe ser al menos 1" };
    const existente = item.id ? previo.find((p) => p.id === item.id) : null;
    out.push({
      id: existente ? existente.id : nanoid(8),
      nombre,
      cantidad,
      fotoUrl: typeof item.fotoUrl === "string" ? item.fotoUrl : "",
      cargado: false,
      cargadoEn: null,
      entregado: false,
      entregadoEn: null
    });
  }
  return { value: out };
}

// Valida y normaliza los datos que carga el cliente al publicar/editar una solicitud.
export function parseSolicitudInput(body = {}, previo = null) {
  const titulo = String(body.titulo || "").trim();
  if (!titulo) return { error: "Falta el título de la solicitud" };
  if (!TIPOS_CARGA.includes(body.tipoCarga)) return { error: "Tipo de carga inválido" };

  const origenLat = parsePunto(body.origenLat);
  const origenLng = parsePunto(body.origenLng);
  const destinoLat = parsePunto(body.destinoLat);
  const destinoLng = parsePunto(body.destinoLng);
  if (origenLat == null || origenLng == null) return { error: "Marcá el origen en el mapa" };
  if (destinoLat == null || destinoLng == null) return { error: "Marcá el destino en el mapa" };

  const tipoVehiculo = body.tipoVehiculo ? String(body.tipoVehiculo) : null;
  if (tipoVehiculo && !TIPOS_VEHICULO.includes(tipoVehiculo)) return { error: "Tipo de vehículo inválido" };

  let fecha = null;
  if (body.fecha) {
    const d = new Date(body.fecha);
    if (Number.isNaN(d.getTime())) return { error: "Fecha inválida" };
    fecha = d.toISOString();
  }

  const inventario = parseInventario(body.inventario || [], previo?.inventario || []);
  if (inventario.error) return inventario;

  return {
    value: {
      titulo,
      tipoCarga: body.tipoCarga,
      descripcion: String(body.descripcion || "").trim(),
      origenDireccion: String(body.origenDireccion || "").trim(),
      origenLat,
      origenLng,
      destinoDireccion: String(body.destinoDireccion || "").trim(),
      destinoLat,
      destinoLng,
      fecha,
      tipoVehiculo,
      fotos: parseFotos(body.fotos),
      inventario: inventario.value
    }
  };
}
