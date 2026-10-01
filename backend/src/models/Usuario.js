import bcrypt from "bcryptjs";
import { nanoid } from "nanoid";
import { db, saveDB } from "../db.js";

// { id, rol, nombre, correo, hashContrasena, telefono, creadoEn, hashTokenReset, tokenResetExpiraEn }

export function findByCorreo(correo) {
  const normalized = String(correo || "").trim().toLowerCase();
  return db.usuarios.find((u) => u.correo === normalized) || null;
}

export function findById(id) {
  return db.usuarios.find((u) => u.id === id) || null;
}

export async function createUsuario({ nombre, correo, contrasena, rol, telefono }) {
  const usuario = {
    id: nanoid(10),
    rol,
    nombre: String(nombre).trim(),
    correo: String(correo).trim().toLowerCase(),
    hashContrasena: bcrypt.hashSync(contrasena, 10),
    telefono: telefono || "",
    creadoEn: new Date().toISOString()
  };
  db.usuarios.push(usuario);
  await saveDB();
  return usuario;
}

export function verifyContrasena(usuario, contrasena) {
  return bcrypt.compareSync(contrasena || "", usuario.hashContrasena);
}

export async function setContrasena(usuario, contrasena) {
  usuario.hashContrasena = bcrypt.hashSync(contrasena, 10);
  await saveDB();
}

// Datos que ve el propio usuario (nunca el hash ni tokens).
export function toPublic(usuario) {
  return { id: usuario.id, nombre: usuario.nombre, rol: usuario.rol, correo: usuario.correo };
}
