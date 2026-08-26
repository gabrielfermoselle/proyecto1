import { Router } from "express";
import { db, saveDB } from "../db.js";
import { authMiddleware, checkRole } from "../auth.js";
import { haversineKm } from "../geo.js";
import { plumberCard, plumberStats, asyncHandler } from "../helpers.js";
import {
  findById,
  findByUserId,
  createPlumber,
  updatePlumber,
  setDisponibilidad,
  toPublic,
  searchByProximity
} from "../models/Plumber.js";

const router = Router();

// Directorio público con filtros: especialidad, texto, calificación mínima y geolocalización (distancia).
function searchPlumbers(req, res) {
  const { especialidad, q, lat, lng, radius, sort, minRating } = req.query;
  const userLat = lat != null ? parseFloat(lat) : null;
  const userLng = lng != null ? parseFloat(lng) : null;
  const maxRadius = radius != null ? parseFloat(radius) : null;
  const minAvgRating = minRating != null ? parseFloat(minRating) : null;

  let list = db.plumbers
    // Solo mostramos perfiles con al menos una especialidad publicada.
    .filter((p) => (p.especialidad || []).length > 0)
    .map((p) => {
      const card = plumberCard(p);
      if (userLat != null && userLng != null && p.latitud != null && p.longitud != null) {
        card.distanceKm =
          Math.round(haversineKm(userLat, userLng, p.latitud, p.longitud) * 10) / 10;
        // Dentro de la zona de radio de trabajo del plomero?
        card.inCoverage = card.distanceKm <= (p.radioTrabajoKm || 0);
      } else {
        card.distanceKm = null;
        card.inCoverage = null;
      }
      return card;
    });

  if (especialidad) {
    const e = String(especialidad).toLowerCase();
    list = list.filter((c) => c.especialidad.some((x) => x.toLowerCase() === e));
  }
  if (q) {
    const term = String(q).toLowerCase();
    list = list.filter(
      (c) =>
        c.name.toLowerCase().includes(term) ||
        c.descripcion.toLowerCase().includes(term) ||
        c.especialidad.some((x) => x.toLowerCase().includes(term))
    );
  }
  // Filtro por distancia máxima solicitada por el usuario.
  if (maxRadius != null && userLat != null && userLng != null) {
    list = list.filter((c) => c.distanceKm != null && c.distanceKm <= maxRadius);
  }
  // Filtro por calificación mínima.
  if (minAvgRating != null && !Number.isNaN(minAvgRating)) {
    list = list.filter((c) => c.avgRating >= minAvgRating);
  }

  if (sort === "distance" && userLat != null) {
    list.sort((a, b) => (a.distanceKm ?? 1e9) - (b.distanceKm ?? 1e9));
  } else if (sort === "rating") {
    list.sort((a, b) => b.avgRating - a.avgRating);
  }

  res.json(list);
}

function parseRequiredNumber(value, name) {
  if (value == null || value === "") {
    return { error: `El parámetro '${name}' es obligatorio` };
  }
  const n = Number(value);
  if (Number.isNaN(n)) {
    return { error: `El parámetro '${name}' debe ser numérico` };
  }
  return { value: n };
}

function parseOptionalNumber(value, name) {
  if (value == null || value === "") return { value: null };
  const n = Number(value);
  if (Number.isNaN(n)) {
    return { error: `El parámetro '${name}' debe ser numérico` };
  }
  return { value: n };
}

// Búsqueda por proximidad (PostGIS): ST_DWithin + ST_Distance, ordenada por distancia.
async function searchPlumbersByProximity(req, res) {
  const latParsed = parseRequiredNumber(req.query.lat, "lat");
  if (latParsed.error) return res.status(400).json({ error: latParsed.error });
  const lngParsed = parseRequiredNumber(req.query.lng, "lng");
  if (lngParsed.error) return res.status(400).json({ error: lngParsed.error });
  const radioParsed = parseRequiredNumber(req.query.radioKm, "radioKm");
  if (radioParsed.error) return res.status(400).json({ error: radioParsed.error });

  const lat = latParsed.value;
  const lng = lngParsed.value;
  const radioKm = radioParsed.value;

  if (lat < -90 || lat > 90) {
    return res.status(400).json({ error: "lat debe estar entre -90 y 90" });
  }
  if (lng < -180 || lng > 180) {
    return res.status(400).json({ error: "lng debe estar entre -180 y 180" });
  }
  if (radioKm <= 0) {
    return res.status(400).json({ error: "radioKm debe ser mayor a 0" });
  }

  const especialidad =
    req.query.especialidad != null && String(req.query.especialidad).trim() !== ""
      ? String(req.query.especialidad).trim()
      : null;

  const califParsed = parseOptionalNumber(req.query.calificacionMinima, "calificacionMinima");
  if (califParsed.error) return res.status(400).json({ error: califParsed.error });
  const calificacionMinima = califParsed.value;
  if (calificacionMinima != null && (calificacionMinima < 0 || calificacionMinima > 5)) {
    return res.status(400).json({ error: "calificacionMinima debe estar entre 0 y 5" });
  }

  const limitParsed = parseOptionalNumber(req.query.limit, "limit");
  if (limitParsed.error) return res.status(400).json({ error: limitParsed.error });
  const offsetParsed = parseOptionalNumber(req.query.offset, "offset");
  if (offsetParsed.error) return res.status(400).json({ error: offsetParsed.error });

  let limit = limitParsed.value == null ? 20 : Math.trunc(limitParsed.value);
  let offset = offsetParsed.value == null ? 0 : Math.trunc(offsetParsed.value);
  if (limit < 1) return res.status(400).json({ error: "limit debe ser mayor a 0" });
  if (limit > 100) limit = 100;
  if (offset < 0) return res.status(400).json({ error: "offset no puede ser negativo" });

  const result = await searchByProximity({
    lat,
    lng,
    radioKm,
    especialidad,
    calificacionMinima,
    limit,
    offset
  });
  res.json(result);
}

router.get("/", searchPlumbers);
router.get("/search", asyncHandler(searchPlumbersByProximity));

// Lista de especialidades disponibles (para filtros).
router.get("/especialidades", (_req, res) => {
  const set = new Set();
  db.plumbers.forEach((p) => (p.especialidad || []).forEach((e) => set.add(e)));
  res.json([...set].sort());
});

// Perfil detallado de un plomero + sus reseñas.
router.get("/:id", (req, res) => {
  const plumber = findById(req.params.id);
  if (!plumber) return res.status(404).json({ error: "Perfil no encontrado" });
  const card = plumberCard(plumber);
  const reviews = db.reviews
    .filter((r) => r.plumberId === plumber.id)
    .map((r) => {
      const client = db.users.find((u) => u.id === r.clientId);
      return {
        id: r.id,
        rating: r.rating,
        comment: r.comment,
        clientName: client ? client.name : "Cliente",
        createdAt: r.createdAt
      };
    })
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json({ ...card, reviews });
});

// Crear el propio perfil de plomero (solo usuarios con rol 'plomero', uno por usuario).
router.post("/", authMiddleware, checkRole("plomero"), asyncHandler(async (req, res) => {
  if (findByUserId(req.user.id)) {
    return res.status(409).json({ error: "Ya tenés un perfil de plomero" });
  }
  const { especialidad, descripcion, hourlyRate, address, radioTrabajoKm, latitud, longitud, fotoUrl, portfolio } =
    req.body || {};
  const plumber = await createPlumber({
    userId: req.user.id,
    especialidad,
    descripcion,
    hourlyRate,
    address,
    radioTrabajoKm,
    latitud,
    longitud,
    fotoUrl,
    portfolio
  });
  res.status(201).json(toPublic(plumber));
}));

// Editar el propio perfil (solo el dueño, con rol 'plomero').
router.put("/:id", authMiddleware, checkRole("plomero"), asyncHandler(async (req, res) => {
  const plumber = findById(req.params.id);
  if (!plumber) return res.status(404).json({ error: "Perfil no encontrado" });
  if (plumber.userId !== req.user.id) {
    return res.status(403).json({ error: "No podés editar el perfil de otro plomero" });
  }
  await updatePlumber(plumber, req.body || {});
  res.json({ ...toPublic(plumber), ...plumberStats(plumber.id) });
}));

// Actualizar solo la disponibilidad (solo el dueño, con rol 'plomero').
router.patch("/:id/disponibilidad", authMiddleware, checkRole("plomero"), asyncHandler(async (req, res) => {
  const plumber = findById(req.params.id);
  if (!plumber) return res.status(404).json({ error: "Perfil no encontrado" });
  if (plumber.userId !== req.user.id) {
    return res.status(403).json({ error: "No podés editar el perfil de otro plomero" });
  }
  const { disponible } = req.body || {};
  if (typeof disponible !== "boolean") {
    return res.status(400).json({ error: "El campo 'disponible' debe ser booleano" });
  }
  await setDisponibilidad(plumber, disponible);
  res.json(toPublic(plumber));
}));

export default router;
