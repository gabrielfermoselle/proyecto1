import { AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatearKg, formatearM3 } from "@/lib/formato";

interface Item {
  id: string;
  nombre: string;
  cantidad: number;
  largoCm: number | null;
  anchoCm: number | null;
  altoCm: number | null;
  pesoKgAprox: number | null;
  fragil: boolean;
  notas: string | null;
}

interface InventarioListaProps {
  items: Item[];
  totales: { pesoTotalKg: number; volumenTotalM3: number; itemsSinMedidas: number };
}

const medidas = ({ largoCm, anchoCm, altoCm }: Item) =>
  largoCm && anchoCm && altoCm ? `${largoCm} × ${anchoCm} × ${altoCm} cm` : null;

export function InventarioLista({ items, totales }: InventarioListaProps) {
  return (
    <div className="grid gap-3">
      {totales.itemsSinMedidas > 0 ? (
        <p className="flex items-start gap-2 rounded-md bg-warning/10 px-3 py-2 text-sm text-warning">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          {totales.itemsSinMedidas === 1
            ? "Un ítem no tiene"
            : `${totales.itemsSinMedidas} ítems no tienen`}{" "}
          medidas o peso: los totales pueden ser mayores. Consultá al cliente antes de presupuestar.
        </p>
      ) : null}
      <ul className="divide-y rounded-lg border bg-card">
        {items.map((item) => (
          <li key={item.id} className="grid gap-1 px-4 py-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold">
                {item.cantidad > 1 ? <span className="tabular-nums">{item.cantidad} × </span> : null}
                {item.nombre}
              </span>
              {item.fragil ? <Badge variant="destructive">Frágil</Badge> : null}
            </div>
            <p className="text-sm text-muted-foreground">
              {[medidas(item), item.pesoKgAprox ? `~${formatearKg(item.pesoKgAprox)} c/u` : null]
                .filter(Boolean)
                .join(" · ") || "Sin medidas"}
            </p>
            {item.notas ? <p className="text-sm">{item.notas}</p> : null}
          </li>
        ))}
      </ul>
      <p className="text-sm">
        Total aproximado: <strong>{formatearKg(totales.pesoTotalKg)}</strong> y{" "}
        <strong>{formatearM3(totales.volumenTotalM3)}</strong> (con margen de estiba).
      </p>
    </div>
  );
}
