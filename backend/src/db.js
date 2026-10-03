import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { supabase, isSupabaseConfigured } from "./supabase.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "..", "data");
const DB_FILE = path.join(DATA_DIR, "db.json");

// Colecciones en memoria. Cada una se persiste en una tabla homónima de Supabase
// (o en data/db.json si Supabase no está configurado).
const EMPTY_DB = {
  usuarios: [],
  fleteros: [],
  solicitudes: [],
  presupuestos: [],
  mensajes: [],
  resenas: []
};

// Orden respetando claves foráneas (padres primero).
const TABLE_ORDER = ["usuarios", "fleteros", "solicitudes", "presupuestos", "mensajes", "resenas"];

// Columnas que pueden quedar vacías: se envían como null explícito para que un
// upsert limpie valores borrados en memoria.
const OPTIONAL_NULLS = {
  usuarios: ["hash_token_reset", "token_reset_expira_en"],
  fleteros: ["latitud", "longitud"],
  solicitudes: ["fletero_id", "presupuesto_id", "precio_acordado", "fecha", "tipo_vehiculo", "completada_en"]
};

// Columnas geography que mantiene un trigger SQL a partir de latitud/longitud.
const SKIP_COLUMNS = new Set(["ubicacion", "origen_ubicacion"]);

const NUMERIC_FIELDS = {
  fleteros: ["tarifaBase", "radioTrabajoKm", "capacidadKg", "latitud", "longitud"],
  solicitudes: ["origenLat", "origenLng", "destinoLat", "destinoLng", "precioAcordado"],
  presupuestos: ["monto"],
  resenas: ["calificacion"]
};

const toSnake = (key) => key.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
const toCamel = (key) => key.replace(/_([a-z])/g, (_m, c) => c.toUpperCase());

let cache = null;
let persistQueue = Promise.resolve();
// Si Supabase está configurado pero no responde al arrancar, se usa el JSON local.
let supabaseActivo = false;

export function usingSupabase() {
  return supabaseActivo;
}

function toRow(table, obj) {
  const row = {};
  for (const [key, value] of Object.entries(obj)) {
    const col = toSnake(key);
    if (value === undefined || SKIP_COLUMNS.has(col)) continue;
    row[col] = value;
  }
  for (const col of OPTIONAL_NULLS[table] || []) {
    if (!(col in row)) row[col] = null;
  }
  return row;
}

function fromRow(table, row) {
  const obj = {};
  for (const [col, value] of Object.entries(row)) {
    if (SKIP_COLUMNS.has(col)) continue;
    obj[toCamel(col)] = value;
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
    const { data, error } = await supabase.from(table).select("*");
    if (error) throw error;
    loaded[table] = (data || []).map((row) => fromRow(table, row));
  }
  return loaded;
}

async function persistToSupabase(data) {
  // Primero borramos lo que ya no existe en memoria (hijos antes que padres)...
  for (const table of [...TABLE_ORDER].reverse()) {
    const keep = new Set((data[table] || []).map((item) => item.id));
    const { data: existing, error: selectError } = await supabase.from(table).select("id");
    if (selectError) throw selectError;
    const extra = (existing || []).map((row) => row.id).filter((id) => !keep.has(id));
    if (extra.length) {
      const { error } = await supabase.from(table).delete().in("id", extra);
      if (error) throw error;
    }
  }
  // ...y después insertamos/actualizamos (padres antes que hijos).
  for (const table of TABLE_ORDER) {
    const rows = (data[table] || []).map((item) => toRow(table, item));
    if (!rows.length) continue;
    const { error } = await supabase.from(table).upsert(rows, { onConflict: "id" });
    if (error) throw error;
  }
}

function loadFromFile() {
  ensureDir();
  if (!fs.existsSync(DB_FILE)) return structuredClone(EMPTY_DB);
  try {
    const raw = fs.readFileSync(DB_FILE, "utf-8");
    const parsed = JSON.parse(raw);
    // Un db.json del esquema anterior (plomeros) no tiene estas colecciones: se reinicia.
    if (!Array.isArray(parsed.usuarios)) return structuredClone(EMPTY_DB);
    return { ...structuredClone(EMPTY_DB), ...parsed };
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
  if (!isSupabaseConfigured && process.env.VERCEL) {
    throw new Error("Faltan SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en las variables de Vercel");
  }
  if (isSupabaseConfigured) {
    try {
      cache = await loadFromSupabase();
      supabaseActivo = true;
      console.log("[db] Conectado a Supabase");
      return cache;
    } catch (err) {
      console.warn(`[db] Supabase no responde (${err.message}). Usando JSON local: ${DB_FILE}`);
    }
  } else {
    console.warn("[db] Faltan SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY. Usando JSON local.");
  }
  cache = loadFromFile();
  saveToFile();
  return cache;
}

export async function saveDB() {
  if (!cache) return;
  const run = persistQueue.then(async () => {
    if (supabaseActivo) {
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
  if (isSupabaseConfigured && !supabaseActivo) {
    try {
      await supabase.from("usuarios").select("id").limit(1).throwOnError();
      supabaseActivo = true;
    } catch (err) {
      console.warn(`[db] Supabase no responde (${err.message}). Se escribe en el JSON local.`);
    }
  }
  cache = { ...structuredClone(EMPTY_DB), ...data };
  await saveDB();
  return cache;
}

export async function pingDatabase() {
  if (!supabaseActivo) return { ok: true, driver: "json" };
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
