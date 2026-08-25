import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { supabase, isSupabaseConfigured } from "./supabase.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "..", "data");
const DB_FILE = path.join(DATA_DIR, "db.json");

const EMPTY_DB = {
  users: [],
  plumbers: [],
  jobs: [],
  reviews: [],
  messages: []
};

const TABLE_ORDER = ["users", "plumbers", "jobs", "reviews", "messages"];

const TABLAS = {
  users: "usuarios",
  plumbers: "plomeros",
  jobs: "trabajos",
  reviews: "resenas",
  messages: "mensajes"
};

const COLUMN_MAP = {
  users: {
    role: "rol",
    name: "nombre",
    email: "correo",
    passwordHash: "hash_contrasena",
    phone: "telefono",
    createdAt: "creado_en",
    resetTokenHash: "hash_token_reset",
    resetTokenExpiresAt: "token_reset_expira_en"
  },
  plumbers: {
    userId: "usuario_id",
    hourlyRate: "tarifa_hora",
    address: "direccion",
    radioTrabajoKm: "radio_trabajo_km",
    fotoUrl: "url_foto",
    portfolio: "portafolio",
    createdAt: "creado_en"
  },
  jobs: {
    clientId: "cliente_id",
    plumberId: "plomero_id",
    title: "titulo",
    description: "descripcion",
    status: "estado",
    agreedPrice: "precio_acordado",
    createdAt: "creado_en",
    completedAt: "completado_en"
  },
  reviews: {
    jobId: "trabajo_id",
    plumberId: "plomero_id",
    clientId: "cliente_id",
    rating: "calificacion",
    comment: "comentario",
    createdAt: "creado_en"
  },
  messages: {
    jobId: "trabajo_id",
    senderId: "remitente_id",
    senderName: "nombre_remitente",
    body: "cuerpo",
    createdAt: "creado_en"
  }
};

let cache = null;
let persistQueue = Promise.resolve();

function invertMap(map) {
  return Object.fromEntries(Object.entries(map).map(([camel, snake]) => [snake, camel]));
}

const OPTIONAL_NULLS = {
  users: ["hash_token_reset", "token_reset_expira_en"],
  plumbers: ["latitud", "longitud"],
  jobs: ["precio_acordado", "completado_en"]
};

const NUMERIC_FIELDS = {
  plumbers: ["hourlyRate", "radioTrabajoKm", "latitud", "longitud"],
  jobs: ["agreedPrice"],
  reviews: ["rating"]
};

function toRow(table, obj) {
  const map = COLUMN_MAP[table] || {};
  const row = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined) continue;
    row[map[key] || key] = value;
  }
  for (const col of OPTIONAL_NULLS[table] || []) {
    if (!(col in row)) row[col] = null;
  }
  return row;
}

function fromRow(table, row) {
  const inv = invertMap(COLUMN_MAP[table] || {});
  const obj = {};
  for (const [key, value] of Object.entries(row)) {
    obj[inv[key] || key] = value;
  }
  for (const field of NUMERIC_FIELDS[table] || []) {
    if (obj[field] != null) obj[field] = Number(obj[field]);
  }
  return obj;
}

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

async function loadFromSupabase() {
  const loaded = structuredClone(EMPTY_DB);
  for (const table of TABLE_ORDER) {
    const { data, error } = await supabase.from(TABLAS[table]).select("*");
    if (error) throw error;
    loaded[table] = (data || []).map((row) => fromRow(table, row));
  }
  return loaded;
}

async function persistToSupabase(data) {
  for (const table of [...TABLE_ORDER].reverse()) {
    const keep = new Set((data[table] || []).map((item) => item.id));
    const tabla = TABLAS[table];
    const { data: existing, error: selectError } = await supabase.from(tabla).select("id");
    if (selectError) throw selectError;
    const extra = (existing || []).map((row) => row.id).filter((id) => !keep.has(id));
    if (extra.length) {
      const { error } = await supabase.from(tabla).delete().in("id", extra);
      if (error) throw error;
    }
  }

  for (const table of TABLE_ORDER) {
    const rows = (data[table] || []).map((item) => toRow(table, item));
    if (!rows.length) continue;
    const { error } = await supabase.from(TABLAS[table]).upsert(rows, { onConflict: "id" });
    if (error) throw error;
  }
}

function loadFromFile() {
  ensureDir();
  if (!fs.existsSync(DB_FILE)) return structuredClone(EMPTY_DB);
  try {
    const raw = fs.readFileSync(DB_FILE, "utf-8");
    return { ...structuredClone(EMPTY_DB), ...JSON.parse(raw) };
  } catch (err) {
    console.error("No se pudo leer la base de datos, se reinicia:", err.message);
    return structuredClone(EMPTY_DB);
  }
}

function saveToFile() {
  ensureDir();
  fs.writeFileSync(DB_FILE, JSON.stringify(cache, null, 2), "utf-8");
}

export async function loadDB() {
  if (cache) return cache;
  if (isSupabaseConfigured) {
    cache = await loadFromSupabase();
    console.log("[db] Conectado a Supabase");
  } else {
    cache = loadFromFile();
    saveToFile();
    console.warn("[db] Faltan SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY. Usando JSON local.");
  }
  return cache;
}

export async function saveDB() {
  if (!cache) return;
  const run = persistQueue.then(async () => {
    if (isSupabaseConfigured) {
      await persistToSupabase(cache);
    } else {
      saveToFile();
    }
  });
  persistQueue = run.catch((err) => {
    console.error("[db] Error al persistir:", err.message);
  });
  return run;
}

export async function resetDB(data) {
  cache = { ...structuredClone(EMPTY_DB), ...data };
  await saveDB();
  return cache;
}

export async function pingDatabase() {
  if (!isSupabaseConfigured) return { ok: true, driver: "json" };
  const { error } = await supabase.from("usuarios").select("id").limit(1);
  if (error) return { ok: false, driver: "supabase", error: error.message };
  return { ok: true, driver: "supabase" };
}

export const db = new Proxy(
  {},
  {
    get(_t, prop) {
      if (!cache) {
        throw new Error("La base de datos todavía no está inicializada. Esperá a loadDB().");
      }
      return cache[prop];
    }
  }
);
