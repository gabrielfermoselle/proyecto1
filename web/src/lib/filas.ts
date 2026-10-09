// Inserciones y lecturas por el cliente de Supabase. Lo usan el seed y los tests de base.
import type { SupabaseClient } from "@supabase/supabase-js";
import { randomBytes } from "node:crypto";

const CON_UPDATED_AT = new Set([
  "usuarios",
  "solicitudes",
  "presupuestos",
  "fletes",
  "controles_item",
  "notificaciones",
]);
const SIN_ID = new Set(["limites_tasa", "subidas_pendientes"]);

export function nuevoId(): string {
  return randomBytes(12).toString("base64url");
}

function valor(clave: string, v: unknown): unknown {
  if (!(v instanceof Date)) return v;
  return clave === "fecha" ? v.toISOString().slice(0, 10) : v.toISOString();
}

function preparar(tabla: string, datos: Record<string, unknown>): Record<string, unknown> {
  const fila: Record<string, unknown> = {};
  for (const [clave, v] of Object.entries(datos)) fila[clave] = valor(clave, v);
  if (!SIN_ID.has(tabla) && fila.id == null) fila.id = nuevoId();
  if (CON_UPDATED_AT.has(tabla) && fila.updatedAt == null) fila.updatedAt = new Date().toISOString();
  return fila;
}

function fallar(tabla: string, error: { message: string; details?: string; code?: string } | null) {
  if (!error) return;
  const wrapped = new Error(`${tabla}: ${error.message}${error.details ? ` (${error.details})` : ""}`) as Error & {
    code?: string;
  };
  if (error.code) wrapped.code = error.code;
  throw wrapped;
}

export async function insertar<T extends Record<string, unknown>>(
  cliente: SupabaseClient,
  tabla: string,
  datos: Record<string, unknown>,
): Promise<T> {
  const fila = preparar(tabla, datos);
  const { data, error } = await cliente.from(tabla).insert(fila).select("*").single();
  fallar(tabla, error);
  return data as T;
}

export async function insertarVarios(
  cliente: SupabaseClient,
  tabla: string,
  filas: Record<string, unknown>[],
): Promise<void> {
  if (filas.length === 0) return;
  const { error } = await cliente.from(tabla).insert(filas.map((fila) => preparar(tabla, fila)));
  fallar(tabla, error);
}

function filtrar<T>(consulta: T, filtros: Record<string, unknown>): T {
  let q = consulta as {
    eq: (c: string, v: unknown) => typeof consulta;
    is: (c: string, v: null) => typeof consulta;
  };
  for (const [clave, v] of Object.entries(filtros)) {
    q = (v === null ? q.is(clave, null) : q.eq(clave, v)) as typeof q;
  }
  return q as T;
}

export async function filas<T>(
  cliente: SupabaseClient,
  tabla: string,
  filtros: Record<string, unknown> = {},
  orden?: { columna: string; asc?: boolean },
): Promise<T[]> {
  let q = cliente.from(tabla).select("*").limit(10000);
  q = filtrar(q, filtros);
  if (orden) q = q.order(orden.columna, { ascending: orden.asc ?? true });
  const { data, error } = await q;
  fallar(tabla, error);
  return (data ?? []) as T[];
}

export async function uno<T>(cliente: SupabaseClient, tabla: string, filtros: Record<string, unknown>): Promise<T> {
  const lista = await filas<T>(cliente, tabla, filtros);
  const fila = lista[0];
  if (!fila) throw new Error(`No hay fila en ${tabla}`);
  return fila;
}

export async function unoONull<T>(
  cliente: SupabaseClient,
  tabla: string,
  filtros: Record<string, unknown>,
): Promise<T | null> {
  const lista = await filas<T>(cliente, tabla, filtros);
  return lista[0] ?? null;
}

export async function contar(
  cliente: SupabaseClient,
  tabla: string,
  filtros: Record<string, unknown> = {},
): Promise<number> {
  let q = cliente.from(tabla).select("*", { count: "exact", head: true });
  q = filtrar(q, filtros);
  const { count, error } = await q;
  fallar(tabla, error);
  return count ?? 0;
}

export async function actualizar(
  cliente: SupabaseClient,
  tabla: string,
  filtros: Record<string, unknown>,
  datos: Record<string, unknown>,
): Promise<void> {
  const cambios: Record<string, unknown> = {};
  for (const [clave, v] of Object.entries(datos)) cambios[clave] = valor(clave, v);
  if (CON_UPDATED_AT.has(tabla) && cambios.updatedAt == null) cambios.updatedAt = new Date().toISOString();
  let q = cliente.from(tabla).update(cambios);
  q = filtrar(q, filtros);
  const { error } = await q;
  fallar(tabla, error);
}

/** Borra todas las filas. Hace falta un filtro: PostgREST no acepta un delete sin condición. */
export async function vaciar(cliente: SupabaseClient, tabla: string, columna = "id"): Promise<void> {
  const { error } = await cliente.from(tabla).delete().not(columna, "is", null);
  fallar(tabla, error);
}
