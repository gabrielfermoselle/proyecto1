interface UbicacionLineaProps {
  etiqueta: string;
  direccion: string;
  piso: number | null;
  ascensor: boolean;
  /** Clase del punto de color (coincide con los pines del mapa). */
  colorPunto: string;
}

/** Origen o destino con piso y ascensor: lo que el fletero necesita para planificar la carga. */
export function UbicacionLinea({ etiqueta, direccion, piso, ascensor, colorPunto }: UbicacionLineaProps) {
  const acceso =
    piso === null
      ? null
      : piso === 0
        ? "Planta baja"
        : `Piso ${piso} ${ascensor ? "con ascensor" : "por escalera"}`;
  return (
    <div className="flex gap-3">
      <span className={`mt-1.5 size-3 shrink-0 rounded-full ${colorPunto}`} aria-hidden="true" />
      <div>
        <p className="text-sm font-semibold text-muted-foreground">{etiqueta}</p>
        <p>{direccion}</p>
        {acceso ? <p className="text-sm text-muted-foreground">{acceso}</p> : null}
      </div>
    </div>
  );
}
