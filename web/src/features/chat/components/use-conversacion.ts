"use client";

import type { RealtimeChannel } from "@supabase/supabase-js";
import { useCallback, useEffect, useRef, useState } from "react";
import { comprimirImagen, subirImagen } from "@/features/uploads/subir-imagen";
import {
  enviarFotoChat,
  enviarMensaje,
  marcarLeido,
  prepararFotoChat,
  proponerHorario,
  responderPropuesta,
} from "../actions";
import type { MensajeDto, RolChat } from "../dto";
import { actualizarPropuesta, fusionarMensajes, ultimoConfirmado, type MensajeVista } from "../hilo";
import type { MetaConversacion } from "../queries";
import { useChat } from "./chat-provider";

const INTERVALO_CONSULTAS_MS = 4_000;
const ESCRIBIENDO_CADA_MS = 3_000;
const ESCRIBIENDO_DURA_MS = 6_000;

interface Inicial {
  meta: MetaConversacion;
  mensajes: MensajeDto[];
  hayMasAnteriores: boolean;
}

type Resultado<T> = { ok: true; data: T } | { ok: false; error: string };

async function obtenerJson<T>(url: string): Promise<T | null> {
  try {
    const r = await fetch(url, { cache: "no-store" });
    return r.ok ? ((await r.json()) as T) : null;
  } catch {
    return null;
  }
}

export function useConversacion(inicial: Inicial) {
  const { miRol, miUserId, realtime, autorizarCanal, refrescarBandeja } = useChat();
  const conversacionId = inicial.meta.id;
  const [meta, setMeta] = useState(inicial.meta);
  const [mensajes, setMensajes] = useState<MensajeVista[]>(inicial.mensajes);
  const [hayMasAnteriores, setHayMasAnteriores] = useState(inicial.hayMasAnteriores);
  const [cargandoAnteriores, setCargandoAnteriores] = useState(false);
  const [otroEscribiendoHasta, setOtroEscribiendoHasta] = useState(0);
  const [otroEnLinea, setOtroEnLinea] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canal = useRef<RealtimeChannel | null>(null);
  const ultimoEscribiendo = useRef(0);
  const ultimaMarcaEnviada = useRef<string | null>(null);
  const mensajesRef = useRef(mensajes);
  mensajesRef.current = mensajes;

  const agregar = useCallback(
    (nuevos: MensajeVista[]) => setMensajes((actuales) => fusionarMensajes(actuales, nuevos)),
    [],
  );

  /** Trae lo nuevo desde el último mensaje confirmado, y el estado actualizado. */
  const sincronizar = useCallback(async () => {
    const ultimo = ultimoConfirmado(mensajesRef.current);
    const url = `/api/chat/${conversacionId}/mensajes${ultimo ? `?despues=${encodeURIComponent(ultimo.cursor)}` : ""}`;
    const datos = await obtenerJson<{ mensajes: MensajeDto[]; meta: MetaConversacion }>(url);
    if (!datos) return;
    agregar(datos.mensajes);
    setMeta(datos.meta);
  }, [conversacionId, agregar]);

  // Canal en vivo de la conversación (o consultas periódicas si no hay Realtime).
  useEffect(() => {
    if (!realtime) {
      const intervalo = setInterval(() => {
        if (document.visibilityState === "visible") void sincronizar();
      }, INTERVALO_CONSULTAS_MS);
      return () => clearInterval(intervalo);
    }
    let activo = true;
    const topic = `conversacion:${conversacionId}`;
    void autorizarCanal(topic).then(() => {
      if (!activo) return;
      const c = realtime
        .channel(topic, {
          config: { private: true, broadcast: { self: false }, presence: { key: miUserId } },
        })
        .on("broadcast", { event: "mensaje.creado" }, ({ payload }) => {
          const mensaje = (payload as { mensaje: MensajeDto }).mensaje;
          agregar([mensaje]);
          // Un mensaje de sistema puede cambiar el estado (confirmado, cancelado…): se refresca la meta.
          if (mensaje.tipo === "SISTEMA") void sincronizar();
          if (mensaje.autorRol && mensaje.autorRol !== miRol) setOtroEscribiendoHasta(0);
        })
        .on("broadcast", { event: "mensajes.leidos" }, ({ payload }) => {
          const { rol, hasta } = payload as { rol: RolChat; hasta: string };
          if (rol !== miRol) setMeta((m) => ({ ...m, leidoHastaOtro: hasta }));
        })
        .on("broadcast", { event: "propuesta.actualizada" }, ({ payload }) => {
          const { propuestaId, estado } = payload as {
            propuestaId: string;
            estado: "ACEPTADA" | "RECHAZADA";
          };
          setMensajes((actuales) => actualizarPropuesta(actuales, propuestaId, estado));
        })
        .on("broadcast", { event: "escribiendo" }, ({ payload }) => {
          if ((payload as { rol: RolChat }).rol !== miRol)
            setOtroEscribiendoHasta(Date.now() + ESCRIBIENDO_DURA_MS);
        })
        .on("presence", { event: "sync" }, () => {
          setOtroEnLinea(Object.keys(c.presenceState()).some((clave) => clave !== miUserId));
        })
        .subscribe(async (estado) => {
          if (estado !== "SUBSCRIBED") return;
          await c.track({ rol: miRol });
          // Al (re)conectar se recupera lo que llegó mientras no estábamos suscriptos.
          void sincronizar();
        });
      canal.current = c;
    });
    return () => {
      activo = false;
      if (canal.current) void realtime.removeChannel(canal.current);
      canal.current = null;
      setOtroEnLinea(false);
    };
  }, [realtime, conversacionId, miRol, miUserId, autorizarCanal, agregar, sincronizar]);

  // El indicador de "escribiendo…" se apaga solo.
  useEffect(() => {
    if (otroEscribiendoHasta === 0) return;
    const espera = setTimeout(
      () => setOtroEscribiendoHasta(0),
      Math.max(otroEscribiendoHasta - Date.now(), 0),
    );
    return () => clearTimeout(espera);
  }, [otroEscribiendoHasta]);

  const avisarEscribiendo = useCallback(() => {
    const ahora = Date.now();
    if (!canal.current || ahora - ultimoEscribiendo.current < ESCRIBIENDO_CADA_MS) return;
    ultimoEscribiendo.current = ahora;
    void canal.current.send({ type: "broadcast", event: "escribiendo", payload: { rol: miRol } });
  }, [miRol]);

  const cargarAnteriores = useCallback(async () => {
    const primero = mensajesRef.current.find((m) => !m.envio);
    if (!primero || cargandoAnteriores || !hayMasAnteriores) return;
    setCargandoAnteriores(true);
    const datos = await obtenerJson<{ mensajes: MensajeDto[]; hayMasAnteriores: boolean }>(
      `/api/chat/${conversacionId}/mensajes?antes=${encodeURIComponent(primero.cursor)}`,
    );
    setCargandoAnteriores(false);
    if (!datos) return;
    agregar(datos.mensajes);
    setHayMasAnteriores(datos.hayMasAnteriores);
  }, [conversacionId, cargandoAnteriores, hayMasAnteriores, agregar]);

  /** Muestra el mensaje al instante y lo concilia con la respuesta del servidor. */
  const enviarOptimista = useCallback(
    async (
      local: Omit<MensajeVista, "id" | "creadoEn" | "cursor" | "autorRol" | "clientId" | "envio">,
      accion: (clientId: string) => Promise<Resultado<MensajeDto>>,
    ) => {
      const clientId = crypto.randomUUID();
      const id = `local-${clientId}`;
      agregar([
        {
          ...local,
          id,
          clientId,
          autorRol: miRol,
          creadoEn: new Date().toISOString(),
          cursor: "",
          envio: "enviando",
        },
      ]);
      setError(null);
      try {
        const resultado = await accion(clientId);
        if (resultado.ok) {
          setMensajes((actuales) =>
            fusionarMensajes(
              actuales.filter((m) => m.id !== id),
              [resultado.data],
            ),
          );
          // Ya se muestra la foto subida: se libera la vista previa local.
          if (local.previewLocal) URL.revokeObjectURL(local.previewLocal);
          refrescarBandeja();
          return true;
        }
        setError(resultado.error);
      } catch {
        setError("No pudimos enviar el mensaje. Revisá tu conexión.");
      }
      setMensajes((actuales) => actuales.map((m) => (m.id === id ? { ...m, envio: "error" } : m)));
      return false;
    },
    [agregar, miRol, refrescarBandeja],
  );

  const enviarTexto = useCallback(
    (texto: string) =>
      enviarOptimista({ tipo: "TEXTO", texto, fotos: [], propuesta: null }, (clientId) =>
        enviarMensaje({ conversacionId, clientId, texto }),
      ),
    [conversacionId, enviarOptimista],
  );

  const enviarFoto = useCallback(
    async (archivo: File, texto: string) => {
      const previewLocal = URL.createObjectURL(archivo);
      return enviarOptimista(
        {
          tipo: "IMAGEN",
          texto: texto || null,
          fotos: [],
          propuesta: null,
          previewLocal,
          archivoLocal: archivo,
        },
        async (clientId) => {
          const preparada = await prepararFotoChat({ conversacionId });
          if (!preparada.ok) return preparada;
          const imagen = await comprimirImagen(archivo);
          const subida = await subirImagen(imagen, preparada.data.subida, preparada.data.storage);
          return enviarFotoChat({ conversacionId, clientId, ...subida, texto });
        },
      );
    },
    [conversacionId, enviarOptimista],
  );

  const proponer = useCallback(
    async (fecha: string, franja: MetaConversacion["fechaActual"]["franja"]): Promise<string | null> => {
      const clientId = crypto.randomUUID();
      const resultado = await proponerHorario({ conversacionId, clientId, fecha, franja });
      if (!resultado.ok) return resultado.error;
      agregar([resultado.data]);
      refrescarBandeja();
      return null;
    },
    [conversacionId, agregar, refrescarBandeja],
  );

  const responder = useCallback(
    async (propuestaId: string, aceptar: boolean) => {
      const resultado = await responderPropuesta({ propuestaId, aceptar });
      if (!resultado.ok) {
        setError(resultado.error);
        return;
      }
      setMensajes((actuales) => actualizarPropuesta(actuales, propuestaId, resultado.data.estado));
      void sincronizar();
    },
    [sincronizar],
  );

  /** Avanza la marca de lectura hasta el último mensaje (solo si cambió). */
  const marcarVisto = useCallback(() => {
    const ultimo = ultimoConfirmado(mensajesRef.current);
    if (!ultimo || ultimo.creadoEn === ultimaMarcaEnviada.current) return;
    ultimaMarcaEnviada.current = ultimo.creadoEn;
    void marcarLeido({ conversacionId, hasta: ultimo.creadoEn }).then(() => refrescarBandeja());
  }, [conversacionId, refrescarBandeja]);

  const reintentar = useCallback(
    (mensaje: MensajeVista) => {
      setMensajes((actuales) => actuales.filter((m) => m.id !== mensaje.id));
      if (mensaje.tipo === "TEXTO" && mensaje.texto) void enviarTexto(mensaje.texto);
      if (mensaje.tipo === "IMAGEN" && mensaje.archivoLocal) {
        // El reenvío crea su propia vista previa.
        if (mensaje.previewLocal) URL.revokeObjectURL(mensaje.previewLocal);
        void enviarFoto(mensaje.archivoLocal, mensaje.texto ?? "");
      }
    },
    [enviarTexto, enviarFoto],
  );

  return {
    meta,
    mensajes,
    hayMasAnteriores,
    cargandoAnteriores,
    otroEscribiendo: otroEscribiendoHasta > 0,
    otroEnLinea,
    enVivo: realtime !== null,
    error,
    limpiarError: () => setError(null),
    /** Trae mensajes nuevos y el estado actualizado (p. ej. después de aceptar el presupuesto). */
    refrescar: () => {
      void sincronizar();
      refrescarBandeja();
    },
    cargarAnteriores,
    enviarTexto,
    enviarFoto,
    proponer,
    responder,
    marcarVisto,
    avisarEscribiendo,
    reintentar,
  };
}
