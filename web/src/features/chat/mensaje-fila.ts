import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { fallar } from "@/lib/db";
import { aMensajeCrudo, SELECT_MENSAJE, type MensajeCrudo } from "./dto";

/** Carga un mensaje con las columnas de SELECT_MENSAJE. */
export async function cargarMensaje(tx: SupabaseClient, id: string): Promise<MensajeCrudo> {
  const { data, error } = await tx.from("mensajes").select(SELECT_MENSAJE).eq("id", id).single();
  fallar(error);
  return aMensajeCrudo(data);
}

export async function buscarMensaje(tx: SupabaseClient, filtro: {
  autorId: string;
  clientId: string;
  conversacionId: string;
}): Promise<MensajeCrudo | null> {
  const { data, error } = await tx
    .from("mensajes")
    .select(SELECT_MENSAJE)
    .eq("autorId", filtro.autorId)
    .eq("clientId", filtro.clientId)
    .eq("conversacionId", filtro.conversacionId)
    .maybeSingle();
  fallar(error);
  return data ? aMensajeCrudo(data) : null;
}

/** Página de mensajes ya en el orden pedido (createdAt, id). */
export async function listarMensajes(
  tx: SupabaseClient,
  conversacionId: string,
  opciones: { filtro?: string; ascendente: boolean; limite: number },
): Promise<MensajeCrudo[]> {
  let q = tx.from("mensajes").select(SELECT_MENSAJE).eq("conversacionId", conversacionId);
  if (opciones.filtro) q = q.or(opciones.filtro);
  const { data, error } = await q
    .order("createdAt", { ascending: opciones.ascendente })
    .order("id", { ascending: opciones.ascendente })
    .limit(opciones.limite);
  fallar(error);
  return (data ?? []).map((fila) => aMensajeCrudo(fila));
}
