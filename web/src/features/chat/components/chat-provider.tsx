"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { NotificacionDto } from "@/features/notificaciones/queries";
import { obtenerTokenRealtime } from "../actions";
import type { RolChat } from "../dto";
import type { ConversacionBandeja } from "../queries";

// Estado compartido del chat en un área (cliente o fletero): conexión en vivo, bandeja y
// notificaciones. Si Supabase no está configurado o la conexión falla, todo sigue funcionando
// con consultas periódicas (modo "consultas").

export type ModoConexion = "conectando" | "vivo" | "consultas";

interface Notificaciones {
  noLeidas: number;
  items: NotificacionDto[];
}

interface ValorChat {
  miUserId: string;
  miRol: RolChat;
  modo: ModoConexion;
  /** Cliente de Supabase ya autenticado para Realtime (null en modo consultas). */
  realtime: SupabaseClient | null;
  /** Renueva el token si el canal todavía no está autorizado (p. ej. una conversación nueva). */
  autorizarCanal: (topic: string) => Promise<void>;
  bandeja: ConversacionBandeja[] | null;
  noLeidos: number;
  notificaciones: Notificaciones;
  refrescarBandeja: () => void;
  refrescarNotificaciones: () => void;
}

const ChatContext = createContext<ValorChat | null>(null);

export function useChat(): ValorChat {
  const valor = useContext(ChatContext);
  if (!valor) throw new Error("useChat necesita un <ChatProvider>");
  return valor;
}

const INTERVALO_CONSULTAS_MS = 30_000;
const MARGEN_RENOVACION_S = 60;

async function obtenerJson<T>(url: string): Promise<T | null> {
  try {
    const respuesta = await fetch(url, { cache: "no-store" });
    return respuesta.ok ? ((await respuesta.json()) as T) : null;
  } catch {
    return null;
  }
}

interface ChatProviderProps {
  miUserId: string;
  miRol: RolChat;
  noLeidosInicial: number;
  notificacionesIniciales: Notificaciones;
  children: React.ReactNode;
}

export function ChatProvider({
  miUserId,
  miRol,
  noLeidosInicial,
  notificacionesIniciales,
  children,
}: ChatProviderProps) {
  const [modo, setModo] = useState<ModoConexion>("conectando");
  const [realtime, setRealtime] = useState<SupabaseClient | null>(null);
  const [bandeja, setBandeja] = useState<ConversacionBandeja[] | null>(null);
  const [noLeidos, setNoLeidos] = useState(noLeidosInicial);
  const [notificaciones, setNotificaciones] = useState(notificacionesIniciales);
  const topicsAutorizados = useRef(new Set<string>());
  const clienteRef = useRef<SupabaseClient | null>(null);
  const renovacion = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refrescarBandeja = useCallback(async () => {
    const datos = await obtenerJson<{ conversaciones: ConversacionBandeja[]; noLeidosTotal: number }>(
      "/api/chat/bandeja",
    );
    if (!datos) return;
    setBandeja(datos.conversaciones);
    setNoLeidos(datos.noLeidosTotal);
  }, []);

  const refrescarNotificaciones = useCallback(async () => {
    const datos = await obtenerJson<Notificaciones>("/api/notificaciones");
    if (datos) setNotificaciones(datos);
  }, []);

  /** Pide un token nuevo (con la lista de canales actualizada) y lo aplica a la conexión. */
  const renovarToken = useCallback(async (): Promise<boolean> => {
    const resultado = await obtenerTokenRealtime({}).catch(() => null);
    const datos = resultado?.ok ? resultado.data : null;
    if (!datos) return false;
    if (!clienteRef.current) {
      // Se descarga solo si hay Realtime configurado: en modo consultas no pesa nada.
      const { createClient } = await import("@supabase/supabase-js");
      clienteRef.current = createClient(datos.url, datos.anonKey, {
        auth: { persistSession: false, autoRefreshToken: false },
        realtime: { params: { eventsPerSecond: 10 } },
      });
    }
    await clienteRef.current.realtime.setAuth(datos.token);
    topicsAutorizados.current = new Set(datos.topics);
    if (renovacion.current) clearTimeout(renovacion.current);
    const enMs = (datos.expiraEn - MARGEN_RENOVACION_S) * 1000 - Date.now();
    renovacion.current = setTimeout(() => void renovarToken(), Math.max(enMs, 10_000));
    return true;
  }, []);

  const autorizarCanal = useCallback(
    async (topic: string) => {
      if (clienteRef.current && !topicsAutorizados.current.has(topic)) await renovarToken();
    },
    [renovarToken],
  );

  // Conexión en vivo: canal personal con avisos de bandeja y notificaciones.
  useEffect(() => {
    let activo = true;
    let desuscribir: (() => void) | null = null;
    void (async () => {
      const conectado = await renovarToken();
      if (!activo) return;
      const cliente = clienteRef.current;
      if (!conectado || !cliente) {
        setModo("consultas");
        return;
      }
      const canal = cliente
        .channel(`usuario:${miUserId}`, { config: { private: true } })
        .on("broadcast", { event: "bandeja.actualizada" }, () => void refrescarBandeja())
        .on("broadcast", { event: "notificacion.creada" }, () => void refrescarNotificaciones())
        .subscribe((estado) => {
          if (estado === "SUBSCRIBED") {
            setRealtime(cliente);
            setModo("vivo");
            // Al (re)conectar se recupera lo que haya pasado mientras tanto.
            void refrescarBandeja();
            void refrescarNotificaciones();
          } else if (estado === "CHANNEL_ERROR" || estado === "TIMED_OUT") {
            setModo("consultas");
          }
        });
      desuscribir = () => void cliente.removeChannel(canal);
    })();
    return () => {
      activo = false;
      desuscribir?.();
      if (renovacion.current) clearTimeout(renovacion.current);
    };
  }, [miUserId, renovarToken, refrescarBandeja, refrescarNotificaciones]);

  // Consultas periódicas: solo sin conexión en vivo y con la pestaña visible.
  useEffect(() => {
    if (modo === "vivo") return;
    const consultar = () => {
      if (document.visibilityState !== "visible") return;
      void refrescarBandeja();
      void refrescarNotificaciones();
    };
    const intervalo = setInterval(consultar, INTERVALO_CONSULTAS_MS);
    document.addEventListener("visibilitychange", consultar);
    return () => {
      clearInterval(intervalo);
      document.removeEventListener("visibilitychange", consultar);
    };
  }, [modo, refrescarBandeja, refrescarNotificaciones]);

  // Funciones estables para el contexto: si cambiaran en cada render, los efectos que dependen de
  // ellas (la bandeja la pide al montarse) se volverían a disparar con cada respuesta, en bucle.
  const pedirBandeja = useCallback(() => void refrescarBandeja(), [refrescarBandeja]);
  const pedirNotificaciones = useCallback(() => void refrescarNotificaciones(), [refrescarNotificaciones]);

  const valor = useMemo<ValorChat>(
    () => ({
      miUserId,
      miRol,
      modo,
      realtime,
      autorizarCanal,
      bandeja,
      noLeidos,
      notificaciones,
      refrescarBandeja: pedirBandeja,
      refrescarNotificaciones: pedirNotificaciones,
    }),
    [
      miUserId,
      miRol,
      modo,
      realtime,
      autorizarCanal,
      bandeja,
      noLeidos,
      notificaciones,
      pedirBandeja,
      pedirNotificaciones,
    ],
  );

  return <ChatContext.Provider value={valor}>{children}</ChatContext.Provider>;
}
