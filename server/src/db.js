import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "..", "data");
const DB_FILE = path.join(DATA_DIR, "db.json");

const EMPTY_DB = {
  users: [], // { id, role, name, email, passwordHash, phone, createdAt }
  workers: [], // { id, userId, oficios[], bio, hourlyRate, lat, lng, address, coverageKm, photoUrl, portfolio[] }
  jobs: [], // { id, clientId, workerId, title, description, status, agreedPrice, createdAt, completedAt }
  reviews: [], // { id, jobId, workerId, clientId, rating, comment, createdAt }
  messages: [] // { id, jobId, senderId, body, createdAt }
};

let cache = null;

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

export function loadDB() {
  if (cache) return cache;
  ensureDir();
  if (!fs.existsSync(DB_FILE)) {
    cache = structuredClone(EMPTY_DB);
    saveDB();
    return cache;
  }
  try {
    const raw = fs.readFileSync(DB_FILE, "utf-8");
    cache = { ...structuredClone(EMPTY_DB), ...JSON.parse(raw) };
  } catch (err) {
    console.error("No se pudo leer la base de datos, se reinicia:", err.message);
    cache = structuredClone(EMPTY_DB);
    saveDB();
  }
  return cache;
}

export function saveDB() {
  ensureDir();
  fs.writeFileSync(DB_FILE, JSON.stringify(cache, null, 2), "utf-8");
}

export function resetDB(data) {
  cache = { ...structuredClone(EMPTY_DB), ...data };
  saveDB();
  return cache;
}

// Convenience accessor
export const db = new Proxy(
  {},
  {
    get(_t, prop) {
      return loadDB()[prop];
    }
  }
);
