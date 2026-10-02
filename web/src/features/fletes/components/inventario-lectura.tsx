import { GaleriaFotos } from "@/components/shared/galeria-fotos";
import { StatTile } from "@/components/shared/stat-tile";
import type { ResumenInventario } from "@/domain/ciclo-flete";
import { formatearFechaHora } from "@/lib/formato";
import { cn } from "@/lib/utils";
import type { ItemDto } from "../queries";
import { DetalleControl, EncabezadoItem } from "./detalle-control";

/** Inventario completo con lo registrado en cada fase. Lo ve el cliente en vivo y ambos al final. */
export function InventarioLectura({ items, titulo = "Inventario" }: { items: ItemDto[]; titulo?: string }) {
  return (
    <section aria-labelledby="titulo-inventario" className="grid gap-3">
      <h2 id="titulo-inventario" className="text-lg font-bold">
        {titulo}
      </h2>
      <ul className="grid gap-2">
        {items.map((item) => {
          const algo = item.carga || item.descarga || item.recepcion;
          return (
            <li key={item.id} className="grid gap-3 rounded-lg border bg-card p-3">
              <EncabezadoItem item={item} />
              {item.carga ? (
                <DetalleControl etiqueta="Carga" control={item.carga} item={item.nombre} />
              ) : null}
              {item.descarga ? (
                <DetalleControl etiqueta="Descarga" control={item.descarga} item={item.nombre} />
              ) : null}
              {item.recepcion ? (
                <DetalleControl etiqueta="Recepción" control={item.recepcion} item={item.nombre} />
              ) : null}
              {item.reclamo ? (
                <div className="grid gap-2 rounded-md bg-destructive/10 p-3 text-sm">
                  <p className="font-semibold text-destructive">
                    Reclamo {item.reclamo.estado === "ABIERTO" ? "abierto" : "resuelto"} ·{" "}
                    <time dateTime={item.reclamo.fecha.toISOString()} className="font-normal">
                      {formatearFechaHora(item.reclamo.fecha)}
                    </time>
                  </p>
                  <p>«{item.reclamo.descripcion}»</p>
                  {item.reclamo.fotos.length > 0 ? (
                    <GaleriaFotos fotos={item.reclamo.fotos} descripcion={`${item.nombre}, reclamo`} />
                  ) : null}
                </div>
              ) : null}
              {!algo ? <p className="text-sm text-muted-foreground">Todavía no se cargó.</p> : null}
              {item.fotos.length > 0 ? (
                <details className="text-sm">
                  <summary className="cursor-pointer font-semibold text-muted-foreground">
                    Fotos de la solicitud ({item.fotos.length})
                  </summary>
                  <div className="pt-2">
                    <GaleriaFotos fotos={item.fotos} descripcion={item.nombre} />
                  </div>
                </details>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** Resumen del inventario: cargados contra entregados, faltantes, daños y reclamos. */
export function ResumenInventarioTiles({
  resumen: r,
  className,
}: {
  resumen: ResumenInventario;
  className?: string;
}) {
  const problemas = r.conDano + r.faltantes;
  return (
    <dl className={cn("grid grid-cols-2 gap-3 lg:grid-cols-4", className)}>
      <StatTile
        label="Cargados"
        value={`${r.cargados} de ${r.total}`}
        detail={
          r.noCargados
            ? `${r.noCargados} sin cargar`
            : r.pendientesCarga
              ? `${r.pendientesCarga} por revisar`
              : null
        }
      />
      <StatTile
        label="Entregados"
        value={`${r.entregados + r.conDano} de ${r.cargados}`}
        detail={r.pendientesDescarga ? `${r.pendientesDescarga} por descargar` : null}
      />
      <StatTile
        label="Faltantes y daños"
        value={problemas}
        detail={problemas ? `${r.faltantes} faltantes · ${r.conDano} con daño` : "Sin problemas reportados"}
        className={problemas ? "border-destructive/50" : ""}
      />
      <StatTile
        label="Reclamos"
        value={r.reclamos}
        detail={r.conformes ? `${r.conformes} recibidos conformes` : null}
        className={r.reclamos ? "border-destructive/50" : ""}
      />
    </dl>
  );
}
