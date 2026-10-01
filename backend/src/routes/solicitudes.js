import { Router } from "express";
import { nanoid } from "nanoid";
import { db, saveDB } from "../db.js";
import { authMiddleware, checkRole } from "../auth.js";
import { asyncHandler, fleteroByUsuario, parseOptionalNumber, round1 } from "../helpers.js";
import { haversineKm } from "../geo.js";
import { TRANSICIONES, TIPOS_VEHICULO } from "../constants.js";
import {
  findSolicitud,
  presupuestosDe,
  puedeVer,
  registrarEstado,
  resumenSolicitud,
  vistaSolicitud,
  parseSolicitudInput
} from "../models/Solicitud.js";

const router = Router();
router.use(authMiddleware);

function loadSolicitud(req, res) {
  const solicitud = findSolicitud(req.params.id);
  if (!solicitud) {
    res.status(404).json({ error: "Solicitud no encontrada" });
    return null;
  }
  if (!puedeVer(req.user, solicitud)) {
    res.status(403).json({ error: "Sin acceso a esta solicitud" });
    return null;
  }
  return solicitud;
}

// ---- Cliente: publicar una solicitud de flete ----
router.post("/", checkRole("cliente"), asyncHandler(async (req, res) => {
  const parsed = parseSolicitudInput(req.body);
  if (parsed.error) return res.status(400).json({ error: parsed.error });

  const solicitud = {
    id: nanoid(10),
    clienteId: req.user.id,
    ...parsed.value,
    estado: "publicada",
    fleteroId: null,
    presupuestoId: null,
    precioAcordado: null,
    historial: [],
    creadoEn: new Date().toISOString(),
    completadaEn: null
  };
  registrarEstado(solicitud, "publicada", req.user.id);
  db.solicitudes.push(solicitud);
  await saveDB();
  res.status(201).json(vistaSolicitud(solicitud, req.user));
}));

// ---- Listado propio ----
// Cliente: sus solicitudes. Fletero: las que tiene asignadas o en las que cotizó.
router.get("/", (req, res) => {
  let list;
  if (req.user.rol === "cliente") {
    list = db.solicitudes.filter((s) => s.clienteId === req.user.id);
  } else {
    const fletero = fleteroByUsuario(req.user.id);
    const cotizadas = new Set(
      fletero ? db.presupuestos.filter((p) => p.fleteroId === fletero.id).map((p) => p.solicitudId) : []
    );
    list = fletero
      ? db.solicitudes.filter((s) => s.fleteroId === fletero.id || cotizadas.has(s.id))
      : [];
  }
  res.json(
    list
      .map((s) => resumenSolicitud(s, req.user))
      .sort((a, b) => new Date(b.creadoEn) - new Date(a.creadoEn))
  );
});

// ---- Fletero: solicitudes publicadas cerca ----
// Por defecto usa la ubicación y el radio de trabajo del fletero; se pueden pisar por query.
router.get("/disponibles", checkRole("fletero"), (req, res) => {
  const fletero = fleteroByUsuario(req.user.id);
  const lat = parseOptionalNumber(req.query.lat) ?? fletero?.latitud ?? null;
  const lng = parseOptionalNumber(req.query.lng) ?? fletero?.longitud ?? null;
  const radioKm = parseOptionalNumber(req.query.radioKm) ?? fletero?.radioTrabajoKm ?? null;
  if ([lat, lng, radioKm].some(Number.isNaN)) {
    return res.status(400).json({ error: "Parámetros numéricos inválidos" });
  }
  const tipoVehiculo = TIPOS_VEHICULO.includes(req.query.tipoVehiculo) ? req.query.tipoVehiculo : null;
  const hasOrigin = lat != null && lng != null;

  let list = db.solicitudes
    .filter((s) => s.estado === "publicada")
    .map((s) => {
      const r = resumenSolicitud(s, req.user);
      r.distanciaKm = hasOrigin ? round1(haversineKm(lat, lng, s.origenLat, s.origenLng)) : null;
      return r;
    });
  if (hasOrigin && radioKm) list = list.filter((s) => s.distanciaKm <= radioKm);
  // Una solicitud sin vehículo preferido la puede tomar cualquiera.
  if (tipoVehiculo) list = list.filter((s) => !s.tipoVehiculo || s.tipoVehiculo === tipoVehiculo);

  list.sort((a, b) =>
    hasOrigin ? a.distanciaKm - b.distanciaKm : new Date(b.creadoEn) - new Date(a.creadoEn)
  );
  res.json({ solicitudes: list, referencia: hasOrigin ? { lat, lng, radioKm } : null });
});

router.get("/:id", (req, res) => {
  const solicitud = loadSolicitud(req, res);
  if (!solicitud) return;
  res.json(vistaSolicitud(solicitud, req.user));
});

// ---- Cliente: editar mientras sigue publicada ----
router.put("/:id", checkRole("cliente"), asyncHandler(async (req, res) => {
  const solicitud = loadSolicitud(req, res);
  if (!solicitud) return;
  if (solicitud.clienteId !== req.user.id) return res.status(403).json({ error: "No es tu solicitud" });
  if (solicitud.estado !== "publicada") {
    return res.status(400).json({ error: "Solo se puede editar una solicitud publicada" });
  }
  const parsed = parseSolicitudInput(req.body, solicitud);
  if (parsed.error) return res.status(400).json({ error: parsed.error });
  Object.assign(solicitud, parsed.value);
  await saveDB();
  res.json(vistaSolicitud(solicitud, req.user));
}));

// ---- Fletero: enviar (o actualizar) su presupuesto ----
router.post("/:id/presupuestos", checkRole("fletero"), asyncHandler(async (req, res) => {
  const solicitud = loadSolicitud(req, res);
  if (!solicitud) return;
  if (solicitud.estado !== "publicada") {
    return res.status(400).json({ error: "La solicitud ya no recibe presupuestos" });
  }
  const fletero = fleteroByUsuario(req.user.id);
  if (!fletero) return res.status(400).json({ error: "Completá tu perfil de fletero primero" });

  const monto = Number(req.body?.monto);
  if (!(monto > 0)) return res.status(400).json({ error: "Ingresá un monto válido" });
  const mensaje = String(req.body?.mensaje || "").trim();

  const existente = presupuestosDe(solicitud.id).find((p) => p.fleteroId === fletero.id);
  if (existente) {
    existente.monto = monto;
    existente.mensaje = mensaje;
  } else {
    db.presupuestos.push({
      id: nanoid(10),
      solicitudId: solicitud.id,
      fleteroId: fletero.id,
      monto,
      mensaje,
      estado: "pendiente",
      creadoEn: new Date().toISOString()
    });
  }
  await saveDB();
  res.json(vistaSolicitud(solicitud, req.user));
}));

// ---- Cliente: elegir un presupuesto → se confirma el flete ----
router.post("/:id/presupuestos/:presupuestoId/aceptar", checkRole("cliente"), asyncHandler(async (req, res) => {
  const solicitud = loadSolicitud(req, res);
  if (!solicitud) return;
  if (solicitud.clienteId !== req.user.id) return res.status(403).json({ error: "No es tu solicitud" });
  if (solicitud.estado !== "publicada") {
    return res.status(400).json({ error: "La solicitud ya tiene un fletero asignado" });
  }
  const presupuestos = presupuestosDe(solicitud.id);
  const elegido = presupuestos.find((p) => p.id === req.params.presupuestoId);
  if (!elegido) return res.status(404).json({ error: "Presupuesto no encontrado" });

  for (const p of presupuestos) p.estado = p.id === elegido.id ? "aceptado" : "rechazado";
  solicitud.fleteroId = elegido.fleteroId;
  solicitud.presupuestoId = elegido.id;
  solicitud.precioAcordado = elegido.monto;
  registrarEstado(solicitud, "confirmada", req.user.id);
  await saveDB();
  res.json(vistaSolicitud(solicitud, req.user));
}));

// ---- Avanzar el estado del flete ----
router.patch("/:id/estado", asyncHandler(async (req, res) => {
  const solicitud = loadSolicitud(req, res);
  if (!solicitud) return;
  const { estado } = req.body || {};
  const permitidos = TRANSICIONES[solicitud.estado]?.[estado];
  if (!permitidos) {
    return res.status(400).json({ error: `Transición inválida desde '${solicitud.estado}'` });
  }

  const fletero = fleteroByUsuario(req.user.id);
  const actor =
    solicitud.clienteId === req.user.id
      ? "cliente"
      : fletero && solicitud.fleteroId === fletero.id
        ? "fletero"
        : null;
  if (!actor || !permitidos.includes(actor)) {
    return res.status(403).json({ error: "No podés realizar esta acción" });
  }

  // Control por inventario: no se sale sin registrar la carga, ni se entrega sin la descarga.
  const inventario = solicitud.inventario || [];
  if (estado === "en_transito" && inventario.some((i) => !i.cargado)) {
    return res.status(400).json({ error: "Registrá la carga de todos los objetos antes de salir" });
  }
  if (estado === "entregada" && inventario.some((i) => !i.entregado)) {
    return res.status(400).json({ error: "Registrá la descarga de todos los objetos" });
  }

  if (estado === "cancelada") {
    for (const p of presupuestosDe(solicitud.id)) {
      if (p.estado === "pendiente") p.estado = "rechazado";
    }
  }
  if (estado === "completada") solicitud.completadaEn = new Date().toISOString();
  registrarEstado(solicitud, estado, req.user.id);
  await saveDB();
  res.json(vistaSolicitud(solicitud, req.user));
}));

// ---- Fletero asignado: registrar carga / descarga de cada objeto ----
router.patch("/:id/inventario/:itemId", checkRole("fletero"), asyncHandler(async (req, res) => {
  const solicitud = loadSolicitud(req, res);
  if (!solicitud) return;
  const fletero = fleteroByUsuario(req.user.id);
  if (!fletero || solicitud.fleteroId !== fletero.id) {
    return res.status(403).json({ error: "Solo el fletero asignado registra el inventario" });
  }
  const item = (solicitud.inventario || []).find((i) => i.id === req.params.itemId);
  if (!item) return res.status(404).json({ error: "Ítem no encontrado" });

  const { cargado, entregado } = req.body || {};
  const ahora = new Date().toISOString();
  if (typeof cargado === "boolean") {
    if (solicitud.estado !== "confirmada") {
      return res.status(400).json({ error: "La carga se registra antes de iniciar el traslado" });
    }
    item.cargado = cargado;
    item.cargadoEn = cargado ? ahora : null;
  }
  if (typeof entregado === "boolean") {
    if (solicitud.estado !== "en_transito") {
      return res.status(400).json({ error: "La descarga se registra durante el traslado" });
    }
    item.entregado = entregado;
    item.entregadoEn = entregado ? ahora : null;
  }
  await saveDB();
  res.json(vistaSolicitud(solicitud, req.user));
}));

export default router;
