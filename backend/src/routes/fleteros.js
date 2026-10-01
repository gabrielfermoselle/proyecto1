import { Router } from "express";
import { db } from "../db.js";
import { authMiddleware, checkRole } from "../auth.js";
import { asyncHandler, fleteroCard, nombreUsuario, parseOptionalNumber } from "../helpers.js";
import { findById, updateFletero, setDisponibilidad, searchFleteros } from "../models/Fletero.js";
import { TIPOS_VEHICULO } from "../constants.js";

const router = Router();

// Búsqueda pública de fleteros.
// Query: tipoVehiculo, precioMaximo, calificacionMinima, lat, lng, radioKm, orden (distancia|calificacion|precio)
router.get("/", asyncHandler(async (req, res) => {
  const q = req.query;
  const lat = parseOptionalNumber(q.lat);
  const lng = parseOptionalNumber(q.lng);
  const radioKm = parseOptionalNumber(q.radioKm);
  const precioMaximo = parseOptionalNumber(q.precioMaximo);
  const calificacionMinima = parseOptionalNumber(q.calificacionMinima);

  if ([lat, lng, radioKm, precioMaximo, calificacionMinima].some(Number.isNaN)) {
    return res.status(400).json({ error: "Parámetros numéricos inválidos" });
  }
  if ((lat == null) !== (lng == null)) {
    return res.status(400).json({ error: "lat y lng deben enviarse juntos" });
  }
  if (lat != null && (lat < -90 || lat > 90 || lng < -180 || lng > 180)) {
    return res.status(400).json({ error: "Coordenadas fuera de rango" });
  }
  if (radioKm != null && radioKm <= 0) {
    return res.status(400).json({ error: "radioKm debe ser mayor a 0" });
  }
  const tipoVehiculo = q.tipoVehiculo && TIPOS_VEHICULO.includes(q.tipoVehiculo) ? q.tipoVehiculo : null;

  const list = await searchFleteros({
    lat,
    lng,
    radioKm,
    tipoVehiculo,
    precioMaximo,
    calificacionMinima,
    orden: q.orden
  });
  res.json(list);
}));

router.get("/vehiculos", (_req, res) => res.json(TIPOS_VEHICULO));

// Perfil público + reseñas verificadas.
router.get("/:id", (req, res) => {
  const fletero = findById(req.params.id);
  if (!fletero) return res.status(404).json({ error: "Fletero no encontrado" });
  const resenas = db.resenas
    .filter((r) => r.fleteroId === fletero.id)
    .map((r) => ({
      id: r.id,
      calificacion: r.calificacion,
      comentario: r.comentario,
      clienteNombre: nombreUsuario(r.clienteId, "Cliente"),
      creadoEn: r.creadoEn
    }))
    .sort((a, b) => new Date(b.creadoEn) - new Date(a.creadoEn));
  res.json({ ...fleteroCard(fletero), resenas });
});

function ownFletero(req, res) {
  const fletero = findById(req.params.id);
  if (!fletero) {
    res.status(404).json({ error: "Fletero no encontrado" });
    return null;
  }
  if (fletero.usuarioId !== req.user.id) {
    res.status(403).json({ error: "No podés editar el perfil de otro fletero" });
    return null;
  }
  return fletero;
}

// Editar perfil, vehículo y zona de trabajo (solo el dueño).
router.put("/:id", authMiddleware, checkRole("fletero"), asyncHandler(async (req, res) => {
  const fletero = ownFletero(req, res);
  if (!fletero) return;
  await updateFletero(fletero, req.body || {});
  res.json(fleteroCard(fletero));
}));

router.patch("/:id/disponibilidad", authMiddleware, checkRole("fletero"), asyncHandler(async (req, res) => {
  const fletero = ownFletero(req, res);
  if (!fletero) return;
  const { disponible } = req.body || {};
  if (typeof disponible !== "boolean") {
    return res.status(400).json({ error: "El campo 'disponible' debe ser booleano" });
  }
  await setDisponibilidad(fletero, disponible);
  res.json(fleteroCard(fletero));
}));

export default router;
