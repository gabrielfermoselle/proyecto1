export type EstadoPaso = "hecho" | "actual" | "pendiente" | "cancelado";

/** Un paso de cualquier línea de tiempo (no sabe nada de fletes). */
export interface PasoTimeline {
  clave: string;
  titulo: string;
  estado: EstadoPaso;
  /** Cuándo ocurrió (los pendientes no tienen). */
  fecha?: Date | null;
  descripcion?: string;
  /** Contenido extra debajo del paso (p. ej. el motivo de una cancelación). */
  detalle?: React.ReactNode;
}
