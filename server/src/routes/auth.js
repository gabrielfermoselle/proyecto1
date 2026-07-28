import { Router } from "express";
import bcrypt from "bcryptjs";
import { nanoid } from "nanoid";
import { db, saveDB } from "../db.js";
import { signToken, authRequired } from "../auth.js";

const router = Router();

router.post("/register", (req, res) => {
  const { name, email, password, role, phone } = req.body || {};
  if (!name || !email || !password || !role) {
    return res.status(400).json({ error: "Faltan campos obligatorios" });
  }
  if (!["client", "worker"].includes(role)) {
    return res.status(400).json({ error: "Rol inválido" });
  }
  const exists = db.users.find(
    (u) => u.email.toLowerCase() === String(email).toLowerCase()
  );
  if (exists) return res.status(409).json({ error: "El email ya está registrado" });

  const user = {
    id: nanoid(10),
    role,
    name: String(name).trim(),
    email: String(email).trim().toLowerCase(),
    passwordHash: bcrypt.hashSync(password, 10),
    phone: phone || "",
    createdAt: new Date().toISOString()
  };
  db.users.push(user);

  // Si es trabajador, creamos un perfil de oficio vacío por defecto.
  if (role === "worker") {
    db.workers.push({
      id: nanoid(10),
      userId: user.id,
      oficios: [],
      bio: "",
      hourlyRate: 0,
      lat: null,
      lng: null,
      address: "",
      coverageKm: 10,
      photoUrl: "",
      portfolio: []
    });
  }
  saveDB();

  const token = signToken(user);
  res.json({ token, user: { id: user.id, name: user.name, role: user.role } });
});

router.post("/login", (req, res) => {
  const { email, password } = req.body || {};
  const user = db.users.find(
    (u) => u.email === String(email || "").trim().toLowerCase()
  );
  if (!user || !bcrypt.compareSync(password || "", user.passwordHash)) {
    return res.status(401).json({ error: "Credenciales incorrectas" });
  }
  const token = signToken(user);
  res.json({ token, user: { id: user.id, name: user.name, role: user.role } });
});

router.get("/me", authRequired, (req, res) => {
  const user = db.users.find((u) => u.id === req.user.id);
  if (!user) return res.status(404).json({ error: "Usuario no encontrado" });
  const worker = db.workers.find((w) => w.userId === user.id) || null;
  res.json({
    user: { id: user.id, name: user.name, role: user.role, email: user.email },
    workerId: worker ? worker.id : null
  });
});

export default router;
