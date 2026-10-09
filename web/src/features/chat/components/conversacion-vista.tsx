"use client";

import { ArrowDown, ArrowLeft, ExternalLink, Loader2, X } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import type { EstadoConversacion } from "@/domain/chat";
import { AccionesChatCliente } from "@/features/clientes/components/acciones-chat-cliente";
import { formatearDia, formatearPesos } from "@/lib/formato";
import { cn } from "@/lib/utils";
import type { MensajeDto } from "../dto";
import { agruparPorDia } from "../hilo";
import type { MetaConversacion } from "../queries";
import { Composer } from "./composer";
import { DialogoPropuesta } from "./dialogo-propuesta";
import { Burbuja, FotosMensaje, MensajeSistema, TarjetaPropuesta } from "./mensaje-item";
import { useConversacion } from "./use-conversacion";

const CERCA_DEL_FINAL_PX = 120;

const BLOQUEO: Partial<Record<EstadoConversacion, string>> = {
  CERRADA: "Esta conversación está cerrada. Podés leerla, pero ya no se pueden enviar mensajes.",
  BLOQUEADA: "El flete se canceló y el chat quedó bloqueado.",
};

function BannerEstado({ meta }: { meta: MetaConversacion }) {
  const textos: Record<EstadoConversacion, string> = {
    NEGOCIACION:
      (meta.presupuesto
        ? `Negociando · presupuesto de ${formatearPesos(meta.presupuesto.monto)}`
        : "Negociando el presupuesto") +
      (meta.fechaAcordada ? ` · fecha acordada: ${formatearDia(meta.fechaAcordada.fecha)}` : ""),
    ACTIVA: `Flete confirmado · ${formatearDia(meta.fechaActual.fecha)}`,
    CERRADA: "Conversación cerrada",
    BLOQUEADA: "Flete cancelado · chat bloqueado",
  };
  return (
    <p
      className={cn(
        "border-b px-4 py-1.5 text-center text-xs font-semibold",
        meta.estado === "ACTIVA" && "bg-success/10 text-success",
        meta.estado === "NEGOCIACION" && "bg-accent/15",
        (meta.estado === "CERRADA" || meta.estado === "BLOQUEADA") && "bg-muted text-muted-foreground",
      )}
    >
      {textos[meta.estado]}
    </p>
  );
}

interface ConversacionVistaProps {
  inicial: { meta: MetaConversacion; mensajes: MensajeDto[]; hayMasAnteriores: boolean };
  fotosHabilitadas: boolean;
  hrefBandeja: string;
}

export function ConversacionVista({ inicial, fotosHabilitadas, hrefBandeja }: ConversacionVistaProps) {
  const c = useConversacion(inicial);
  const { meta, marcarVisto, cargarAnteriores } = c;
  const scroller = useRef<HTMLDivElement>(null);
  const centinela = useRef<HTMLLIElement>(null);
  const [nuevosAbajo, setNuevosAbajo] = useState(0);
  const [anuncio, setAnuncio] = useState("");
  const previo = useRef({ primerId: c.mensajes[0]?.id, ultimoId: c.mensajes.at(-1)?.id, alto: 0 });

  const cercaDelFinal = useCallback(() => {
    const el = scroller.current;
    return !el || el.scrollHeight - el.scrollTop - el.clientHeight < CERCA_DEL_FINAL_PX;
  }, []);

  const irAlFinal = useCallback((suave = false) => {
    const el = scroller.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: suave ? "smooth" : "auto" });
    setNuevosAbajo(0);
  }, []);

  /** Marca como leído solo si de verdad se está viendo el final de la conversación. */
  const intentarMarcarVisto = useCallback(() => {
    if (document.visibilityState === "visible" && document.hasFocus() && cercaDelFinal()) marcarVisto();
  }, [marcarVisto, cercaDelFinal]);

  // Al abrir: al final.
  useLayoutEffect(() => irAlFinal(), [irAlFinal]);

  // Al cambiar la lista: si se cargaron anteriores, se conserva la posición; si llegaron nuevos,
  // se baja solo si ya estaba abajo (si no, aparece la pastilla "Nuevos mensajes").
  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const primero = c.mensajes[0];
    const ultimo = c.mensajes.at(-1);
    const antes = previo.current;
    if (primero && primero.id !== antes.primerId && antes.alto > 0) {
      el.scrollTop += el.scrollHeight - antes.alto;
    } else if (ultimo && ultimo.id !== antes.ultimoId) {
      const propio = ultimo.autorRol === meta.miRol;
      if (propio || el.scrollHeight - el.scrollTop - el.clientHeight < CERCA_DEL_FINAL_PX * 3)
        irAlFinal(true);
      else setNuevosAbajo((n) => n + 1);
      if (!propio && ultimo.tipo !== "SISTEMA" && ultimo.texto)
        setAnuncio(`${meta.contraparte}: ${ultimo.texto}`);
    }
    previo.current = { primerId: primero?.id, ultimoId: ultimo?.id, alto: el.scrollHeight };
    intentarMarcarVisto();
  }, [c.mensajes, meta.miRol, meta.contraparte, irAlFinal, intentarMarcarVisto]);

  // Scroll infinito hacia arriba.
  useEffect(() => {
    const objetivo = centinela.current;
    if (!objetivo) return;
    const observador = new IntersectionObserver(
      ([entrada]) => {
        if (entrada?.isIntersecting && scroller.current) {
          previo.current.alto = scroller.current.scrollHeight;
          void cargarAnteriores();
        }
      },
      { root: scroller.current, rootMargin: "200px 0px 0px 0px" },
    );
    observador.observe(objetivo);
    return () => observador.disconnect();
  }, [cargarAnteriores]);

  useEffect(() => {
    window.addEventListener("focus", intentarMarcarVisto);
    document.addEventListener("visibilitychange", intentarMarcarVisto);
    return () => {
      window.removeEventListener("focus", intentarMarcarVisto);
      document.removeEventListener("visibilitychange", intentarMarcarVisto);
    };
  }, [intentarMarcarVisto]);

  const estadoLinea = c.otroEscribiendo ? "escribiendo…" : c.otroEnLinea ? "en línea" : meta.titulo;

  return (
    <section
      aria-label={`Conversación con ${meta.contraparte}`}
      className="flex h-full min-h-0 flex-col bg-background"
    >
      <header className="flex items-center gap-2 border-b bg-card px-2 py-2">
        <Button asChild variant="ghost" size="icon" className="lg:hidden">
          <Link href={hrefBandeja}>
            <ArrowLeft aria-hidden="true" />
            <span className="sr-only">Volver a los mensajes</span>
          </Link>
        </Button>
        <span className="relative grid size-10 shrink-0 place-items-center rounded-full bg-secondary font-heading font-extrabold text-secondary-foreground">
          {meta.contraparte.charAt(0)}
          {c.otroEnLinea ? (
            <span
              className="absolute bottom-0 right-0 size-3 rounded-full border-2 border-card bg-success"
              aria-hidden="true"
            />
          ) : null}
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-bold leading-tight">{meta.contraparte}</h1>
          <p
            className={cn(
              "truncate text-sm",
              c.otroEscribiendo || c.otroEnLinea ? "text-success" : "text-muted-foreground",
            )}
            aria-live="polite"
          >
            {estadoLinea}
          </p>
        </div>
        {meta.hrefDetalle ? (
          <Button asChild variant="ghost" size="sm">
            <Link href={meta.hrefDetalle}>
              <span className="sr-only sm:not-sr-only">Ver el pedido</span>
              <ExternalLink aria-hidden="true" />
            </Link>
          </Button>
        ) : null}
      </header>
      <BannerEstado meta={meta} />
      {meta.miRol === "CLIENTE" ? <AccionesChatCliente meta={meta} onActualizado={c.refrescar} /> : null}

      <div className="relative min-h-0 flex-1">
        <div
          ref={scroller}
          onScroll={() => (cercaDelFinal() ? (setNuevosAbajo(0), intentarMarcarVisto()) : null)}
          // Enfocable para poder recorrer el historial con el teclado (flechas, AvPág).
          tabIndex={0}
          role="region"
          aria-label="Historial de mensajes"
          className="h-full overflow-y-auto overscroll-contain bg-muted/30 py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
        >
          <ol aria-label="Mensajes" className="grid gap-1">
            <li ref={centinela} className="flex justify-center py-2 text-xs text-muted-foreground">
              {c.cargandoAnteriores ? (
                <Loader2 className="size-4 animate-spin" aria-label="Cargando mensajes anteriores" />
              ) : c.hayMasAnteriores ? (
                <span className="sr-only">Hay mensajes anteriores</span>
              ) : (
                "Comienzo de la conversación"
              )}
            </li>
            {agruparPorDia(c.mensajes).map(({ dia, mensajes }) => (
              <li key={dia}>
                <h2 className="sticky top-0 z-10 flex justify-center py-1">
                  <span className="rounded-full bg-card/95 px-3 py-0.5 text-xs font-semibold text-muted-foreground shadow-sm">
                    {formatearDia(dia, { largo: true })}
                  </span>
                </h2>
                <ol className="grid gap-1">
                  {mensajes.map((m) =>
                    m.tipo === "SISTEMA" ? (
                      <MensajeSistema key={m.id} mensaje={m} />
                    ) : m.tipo === "PROPUESTA" ? (
                      <TarjetaPropuesta
                        key={m.id}
                        mensaje={m}
                        miRol={meta.miRol}
                        puedeResponder={meta.puedeProponer}
                        conflictos={m.propuesta ? meta.conflictos[m.propuesta.id] : undefined}
                        onResponder={(id, aceptar) => void c.responder(id, aceptar)}
                      />
                    ) : (
                      <Burbuja
                        key={m.id}
                        mensaje={m}
                        miRol={meta.miRol}
                        leidoHastaOtro={meta.leidoHastaOtro}
                        onReintentar={c.reintentar}
                      >
                        {m.tipo === "IMAGEN" ? <FotosMensaje mensaje={m} /> : null}
                      </Burbuja>
                    ),
                  )}
                </ol>
              </li>
            ))}
          </ol>
        </div>
        {nuevosAbajo > 0 ? (
          <Button
            size="sm"
            className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full shadow-lg"
            onClick={() => irAlFinal(true)}
          >
            <ArrowDown aria-hidden="true" />
            {nuevosAbajo === 1 ? "1 mensaje nuevo" : `${nuevosAbajo} mensajes nuevos`}
          </Button>
        ) : null}
      </div>

      <p className="sr-only" aria-live="polite">
        {anuncio}
      </p>
      {c.error ? (
        <Alert variant="destructive" className="rounded-none border-x-0 border-b-0">
          <p className="flex-1">{c.error}</p>
          <button type="button" onClick={c.limpiarError} className="shrink-0">
            <X className="size-4" aria-hidden="true" />
            <span className="sr-only">Cerrar aviso</span>
          </button>
        </Alert>
      ) : null}
      <Composer
        bloqueo={BLOQUEO[meta.estado] ?? null}
        fotosHabilitadas={fotosHabilitadas}
        contactoVisible={meta.contactoVisible}
        onEnviarTexto={c.enviarTexto}
        onEnviarFoto={c.enviarFoto}
        onEscribiendo={c.avisarEscribiendo}
        acciones={
          meta.puedeProponer ? (
            <DialogoPropuesta fechaActual={meta.fechaActual} onProponer={c.proponer} />
          ) : null
        }
      />
    </section>
  );
}
