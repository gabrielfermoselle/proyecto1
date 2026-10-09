// Textos y armado de datos para mostrar el flete. Sin dependencias de servidor.

import type { PasoTimeline } from "@/components/shared/timeline/tipos";
import type { FaseControl, ResultadoControl } from "@/domain/catalogos";
import { DESCRIPCION_ETAPA, ETIQUETA_CICLO, RECORRIDO_FLETE, type PasoCiclo } from "@/domain/ciclo-flete";

export function pasosTimeline(
  pasos: PasoCiclo[],
  cancelacion: { nota: string | null; porRol: "CLIENTE" | "FLETERO" } | null,
): PasoTimeline[] {
  return pasos.map((p) => ({
    clave: p.etapa,
    titulo: ETIQUETA_CICLO[p.etapa],
    estado: p.estado,
    fecha: p.fecha,
    descripcion:
      p.etapa === "CANCELADO" && cancelacion
        ? `Lo canceló ${cancelacion.porRol === "CLIENTE" ? "el cliente" : "el fletero"}${cancelacion.nota ? `: «${cancelacion.nota}»` : "."}`
        : DESCRIPCION_ETAPA[p.etapa],
  }));
}

export interface TextosFase {
  titulo: string;
  ayuda: string;
  /** Texto del toque rápido ("todo bien"). */
  ok: string;
  /** Botón para registrar con detalle. */
  conDetalle: string;
  /** "7 de 9 cargados". */
  hechos: string;
}

export const TEXTOS_FASE: Record<FaseControl, TextosFase> = {
  CARGA: {
    titulo: "Check-in de carga",
    ayuda:
      "Tocá cada ítem a medida que lo subís. Si tiene un detalle previo (un rayón, una pata floja), anotalo con foto.",
    ok: "Cargado",
    conDetalle: "Observación",
    hechos: "resueltos",
  },
  DESCARGA: {
    titulo: "Check-out de descarga",
    ayuda: "Tocá cada ítem a medida que lo bajás. Si llegó con un daño o falta, reportalo.",
    ok: "Entregado",
    conDetalle: "Problema",
    hechos: "resueltos",
  },
  RECEPCION: {
    titulo: "Revisá lo que recibiste",
    ayuda: "Confirmá cada ítem o todos juntos. Si algo llegó mal o falta, abrí un reclamo con una foto.",
    ok: "Recibido",
    conDetalle: "Reclamo",
    hechos: "revisados",
  },
};

/** Cómo se presenta cada resultado en la hoja de detalle. */
export const OPCION_RESULTADO: Record<
  ResultadoControl,
  { titulo: string; descripcion: string; placeholder: string }
> = {
  CARGADO: {
    titulo: "Cargado, con una observación",
    descripcion: "Lo subiste, pero tenía un detalle previo.",
    placeholder: "Ej.: Rayón previo en la tapa del lado derecho.",
  },
  NO_CARGADO: {
    titulo: "No se cargó",
    descripcion: "No viaja en este flete.",
    placeholder: "Ej.: El cliente decidió no mandarlo.",
  },
  ENTREGADO: {
    titulo: "Entregado, con una observación",
    descripcion: "Llegó bien, pero querés dejar una nota.",
    placeholder: "Ej.: Lo dejé en la cochera, como pidió el cliente.",
  },
  CON_DANO: {
    titulo: "Llegó con un daño",
    descripcion: "Contá qué pasó y sacale una foto.",
    placeholder: "Ej.: Se rajó el vidrio de la puerta en el viaje.",
  },
  FALTANTE: {
    titulo: "Falta",
    descripcion: "Se cargó pero no está al descargar.",
    placeholder: "Ej.: No encuentro la caja 3 en la caja del camión.",
  },
  CONFORME: {
    titulo: "Recibido conforme",
    descripcion: "Llegó como esperabas.",
    placeholder: "",
  },
  RECLAMO: {
    titulo: "Abrir un reclamo",
    descripcion: "Queda registrado y le avisamos al fletero.",
    placeholder: "Ej.: La mesa llegó con una pata rota.",
  },
};

/** Resultados que ofrece la hoja de detalle en cada fase (el "todo bien" va con el toque rápido). */
export const OPCIONES_DETALLE: Record<FaseControl, ResultadoControl[]> = {
  CARGA: ["CARGADO", "NO_CARGADO"],
  DESCARGA: ["CON_DANO", "FALTANTE", "ENTREGADO"],
  RECEPCION: ["RECLAMO"],
};

/** Tono del resultado: para el color del chip. */
export function tonoResultado(r: ResultadoControl): "ok" | "alerta" | "neutro" {
  if (r === "CON_DANO" || r === "FALTANTE" || r === "RECLAMO") return "alerta";
  if (r === "NO_CARGADO") return "neutro";
  return "ok";
}

/** La etapa en la que está el flete dentro de su recorrido (desde CONFIRMADO), para mostrarla en texto. */
export function etapaEnCurso(pasos: PasoCiclo[]): { numero: number; total: number; titulo: string } | null {
  const tramo = pasos.filter((p) => (RECORRIDO_FLETE as readonly string[]).includes(p.etapa));
  if (pasos.some((p) => p.etapa === "CANCELADO")) return null;
  const actual = tramo.findIndex((p) => p.estado === "actual");
  const indice = actual >= 0 ? actual : tramo.length - 1;
  const paso = tramo[indice];
  return paso
    ? { numero: indice + 1, total: RECORRIDO_FLETE.length, titulo: ETIQUETA_CICLO[paso.etapa] }
    : null;
}
