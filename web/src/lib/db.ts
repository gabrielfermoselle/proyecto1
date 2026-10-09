import "server-only";
import { randomBytes } from "node:crypto";
import type { PostgrestError } from "@supabase/supabase-js";
import { supabaseAdmin } from "./supabase";

/** Id de texto, del mismo estilo que los que ya están en la base. */
export function nuevoId(): string {
  return randomBytes(12).toString("base64url");
}

export function db() {
  const cliente = supabaseAdmin();
  if (!cliente) {
    throw new Error("Faltan SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY");
  }
  return cliente;
}

export function fallar(error: PostgrestError | null): void {
  if (!error) return;
  const wrapped = new Error(error.message) as Error & { code?: string; details?: string };
  wrapped.code = error.code;
  wrapped.details = error.details;
  throw wrapped;
}

/** Una relación 1:1 de PostgREST puede venir como objeto o como arreglo de un elemento. */
export function relacion<T>(valor: T | T[] | null | undefined): T | null {
  if (valor == null) return null;
  return Array.isArray(valor) ? (valor[0] ?? null) : valor;
}

/** Decimal de Postgres: PostgREST lo devuelve como número o como texto. */
export function numero(valor: unknown): number {
  if (typeof valor === "number") return valor;
  if (typeof valor === "string") return Number(valor);
  return Number(valor ?? 0);
}

export function ahoraIso(): string {
  return new Date().toISOString();
}

/**
 * Corre un SELECT parametrizado (PostGIS y bandejas). Los valores van aparte del texto:
 * la función de la base solo la puede ejecutar service_role.
 */
export async function consulta<T>(sql: string, params: unknown[] = []): Promise<T[]> {
  const marcado = sql.replace(/\$(\d+)/g, (_, n: string) => `$#${n.padStart(3, "0")}#`);
  const { data, error } = await db().rpc("consulta_json", { p_sql: marcado, p_params: params });
  fallar(error);
  return (data ?? []) as T[];
}
