import { formatearMes, formatearPesos } from "@/lib/formato";
import { cn } from "@/lib/utils";

// Una sola serie (ganancias por mes): sin leyenda, el título dice qué se grafica.
// Colores validados con el validador de dataviz sobre la tarjeta (#f8f3e7): ambos ≥ 3:1 y
// ΔE ≥ 22 entre sí bajo daltonismo. El mes actual además lleva su valor escrito.
const COLOR_ACTUAL = "#7a1f1f";
const COLOR_ANTERIOR = "#b0716c";

const compacto = new Intl.NumberFormat("es-AR", { notation: "compact", maximumFractionDigits: 1 });

/** Máximo "redondo" del eje (1, 2 o 5 × 10^n) para que las marcas sean números limpios. */
function maximoRedondo(valor: number): number {
  if (valor <= 0) return 1;
  const potencia = 10 ** Math.floor(Math.log10(valor));
  return ([1, 2, 5, 10].find((m) => m * potencia >= valor) ?? 10) * potencia;
}

export function GananciasChart({ datos }: { datos: { mes: string; total: number }[] }) {
  const maximo = maximoRedondo(Math.max(...datos.map((d) => d.total)));
  const marcas = [maximo, maximo / 2, 0];
  const indiceActual = datos.length - 1;

  return (
    <figure className="grid gap-3">
      <div className="grid grid-cols-[auto_1fr] gap-2">
        {/* Eje Y: texto en tinta atenuada, nunca en el color de la serie. */}
        <div
          className="flex h-44 flex-col justify-between text-right text-xs text-muted-foreground"
          aria-hidden="true"
        >
          {marcas.map((m) => (
            <span key={m} className="-translate-y-1/2 first:translate-y-0 last:translate-y-0">
              ${compacto.format(m)}
            </span>
          ))}
        </div>
        <div className="relative h-44">
          {/* Grilla recesiva. */}
          <div
            className="pointer-events-none absolute inset-0 flex flex-col justify-between"
            aria-hidden="true"
          >
            {marcas.map((m) => (
              <span
                key={m}
                className={cn("border-t", m === 0 ? "border-foreground/30" : "border-dashed border-border")}
              />
            ))}
          </div>
          <ul className="relative flex h-full items-end" aria-label="Ganancias por mes">
            {datos.map((d, i) => {
              const esActual = i === indiceActual;
              const altura = (d.total / maximo) * 100;
              const etiqueta = `${formatearMes(d.mes)}: ${formatearPesos(d.total)}`;
              return (
                <li key={d.mes} className="flex h-full flex-1 justify-center">
                  {/* El área de interacción es toda la columna, más grande que la barra. */}
                  <div
                    tabIndex={0}
                    role="img"
                    aria-label={etiqueta}
                    className="group relative flex h-full w-full max-w-16 cursor-default flex-col items-center justify-end rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <span
                      className={cn(
                        "pointer-events-none absolute z-10 whitespace-nowrap rounded-md border bg-popover px-2 py-1 text-xs shadow-md transition-opacity",
                        "opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100",
                        esActual && "hidden",
                      )}
                      style={{ bottom: `calc(${altura}% + 6px)` }}
                      aria-hidden="true"
                    >
                      <strong className="block text-sm">{formatearPesos(d.total)}</strong>
                      <span className="text-muted-foreground">{formatearMes(d.mes)}</span>
                    </span>
                    {esActual ? (
                      <span className="mb-1 text-xs font-bold" aria-hidden="true">
                        ${compacto.format(d.total)}
                      </span>
                    ) : null}
                    <span
                      className="w-full max-w-6 rounded-t-[4px] transition-[filter] group-hover:brightness-110"
                      style={{
                        height: `${altura}%`,
                        minHeight: d.total > 0 ? 2 : 0,
                        backgroundColor: esActual ? COLOR_ACTUAL : COLOR_ANTERIOR,
                      }}
                      aria-hidden="true"
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
        <span aria-hidden="true" />
        <ol className="flex text-xs text-muted-foreground" aria-hidden="true">
          {datos.map((d, i) => (
            <li
              key={d.mes}
              className={cn("flex-1 text-center", i === indiceActual && "font-bold text-foreground")}
            >
              {formatearMes(d.mes)}
            </li>
          ))}
        </ol>
      </div>
      <details className="text-sm">
        <summary className="cursor-pointer font-semibold text-primary">Ver como tabla</summary>
        <table className="mt-2 w-full">
          <caption className="sr-only">Ganancias por mes</caption>
          <thead>
            <tr className="border-b text-left text-muted-foreground">
              <th scope="col" className="py-1 font-semibold">
                Mes
              </th>
              <th scope="col" className="py-1 text-right font-semibold">
                Ganancias
              </th>
            </tr>
          </thead>
          <tbody>
            {datos.map((d) => (
              <tr key={d.mes} className="border-b last:border-0">
                <th scope="row" className="py-1 text-left font-normal capitalize">
                  {formatearMes(d.mes)} {d.mes.slice(0, 4)}
                </th>
                <td className="py-1 text-right tabular-nums">{formatearPesos(d.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
