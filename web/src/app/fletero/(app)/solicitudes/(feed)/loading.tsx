import { Skeleton } from "@/components/ui/skeleton";

export default function CargandoSolicitudes() {
  return (
    <div className="grid gap-5" aria-busy="true" aria-label="Cargando solicitudes">
      <Skeleton className="h-9 w-48" />
      <Skeleton className="h-12 w-full max-w-md" />
      <div className="grid gap-3 lg:grid-cols-2">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-56 w-full" />
        ))}
      </div>
    </div>
  );
}
