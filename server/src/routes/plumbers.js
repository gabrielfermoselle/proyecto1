import { Router } from "express";
import { authMiddleware, checkRole } from "../auth.js";
import {
  findById,
  findByUserId,
  createPlumber,
  updatePlumber,
  setDisponibilidad,
  toPublic
} from "../models/Plumber.js";

const router = Router();

// Crear el propio perfil de plomero (solo usuarios con rol 'plomero', uno por usuario).
router.post("/", authMiddleware, checkRole("plomero"), (req, res) => {
  if (findByUserId(req.user.id)) {
    return res.status(409).json({ error: "Ya tenés un perfil de plomero" });
  }
  const { especialidad, descripcion, radioTrabajoKm, latitud, longitud, fotoUrl } = req.body || {};
  const plumber = createPlumber({
    userId: req.user.id,
    especialidad,
    descripcion,
    radioTrabajoKm,
    latitud,
    longitud,
    fotoUrl
  });
  res.status(201).json(toPublic(plumber));
});

// Perfil público de un plomero.
router.get("/:id", (req, res) => {
  const plumber = findById(req.params.id);
  if (!plumber) return res.status(404).json({ error: "Perfil no encontrado" });
  res.json(toPublic(plumber));
});

// Editar el propio perfil (solo el dueño, con rol 'plomero').
router.put("/:id", authMiddleware, checkRole("plomero"), (req, res) => {
  const plumber = findById(req.params.id);
  if (!plumber) return res.status(404).json({ error: "Perfil no encontrado" });
  if (plumber.userId !== req.user.id) {
    return res.status(403).json({ error: "No podés editar el perfil de otro plomero" });
  }
  updatePlumber(plumber, req.body || {});
  res.json(toPublic(plumber));
});

// Actualizar solo la disponibilidad (solo el dueño, con rol 'plomero').
router.patch("/:id/disponibilidad", authMiddleware, checkRole("plomero"), (req, res) => {
  const plumber = findById(req.params.id);
  if (!plumber) return res.status(404).json({ error: "Perfil no encontrado" });
  if (plumber.userId !== req.user.id) {
    return res.status(403).json({ error: "No podés editar el perfil de otro plomero" });
  }
  const { disponible } = req.body || {};
  if (typeof disponible !== "boolean") {
    return res.status(400).json({ error: "El campo 'disponible' debe ser booleano" });
  }
  setDisponibilidad(plumber, disponible);
  res.json(toPublic(plumber));
});

export default router;
