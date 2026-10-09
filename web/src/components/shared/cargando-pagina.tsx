import { Skeleton } from "@/components/ui/skeleton";

/**
 * Esqueleto mientras llega una página del servidor: el click responde al instante (Next lo
 * prefetchea) y la página real lo reemplaza apenas tiene los datos.
 */
export function CargandoPagina({ variante = "lista" }: { variante?: "lista" | "detalle" }) {
  return (
    <div className="grid gap-6" aria-busy="true">
      <span className="sr-only" role="status">
        Cargando…
      </span>
      <div className="grid gap-2">
        <Skeleton className="h-10 w-64 max-w-full" />
        <Skeleton className="h-5 w-96 max-w-full" />
      </div>
      {variante === "detalle" ? (
        <>
          <Skeleton className="h-24 w-full rounded-xl" />
          <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
            <div className="grid gap-4">
              <Skeleton className="h-48 w-full rounded-xl" />
              <Skeleton className="h-48 w-full rounded-xl" />
            </div>
            <Skeleton className="h-72 w-full rounded-xl" />
          </div>
        </>
      ) : (
        <div className="grid gap-3">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-xl" />
          ))}
        </div>
      )}
    </div>
  );
}
