import bcrypt from "bcryptjs";
import { nanoid } from "nanoid";
import { db, saveDB } from "../db.js";

// { id, role, name, email, passwordHash, phone, createdAt, resetTokenHash, resetTokenExpiresAt }
export const ROLES = ["client", "plomero"];

export function findByEmail(email) {
  const normalized = String(email || "").trim().toLowerCase();
  return db.users.find((u) => u.email === normalized) || null;
}

export function findById(id) {
  return db.users.find((u) => u.id === id) || null;
}

export function createUser({ name, email, password, role, phone }) {
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
  saveDB();
  return user;
}

export function verifyPassword(user, password) {
  return bcrypt.compareSync(password || "", user.passwordHash);
}

export function setPassword(user, password) {
  user.passwordHash = bcrypt.hashSync(password, 10);
  saveDB();
}

export function toPublic(user) {
  return { id: user.id, name: user.name, role: user.role, email: user.email };
}
