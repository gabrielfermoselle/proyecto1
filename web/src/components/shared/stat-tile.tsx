import { cn } from "@/lib/utils";

interface StatTileProps {
  label: string;
  value: React.ReactNode;
  detail?: React.ReactNode;
  className?: string;
}

/** Indicador: etiqueta, valor destacado (cifras proporcionales) y un detalle opcional. */
export function StatTile({ label, value, detail, className }: StatTileProps) {
  return (
    <div className={cn("grid content-start gap-1 rounded-lg border bg-card p-4 shadow-sm", className)}>
      <dt className="text-sm font-semibold text-muted-foreground">{label}</dt>
      <dd className="font-sans text-2xl font-bold leading-tight sm:text-3xl">{value}</dd>
      {detail ? <dd className="text-sm text-muted-foreground">{detail}</dd> : null}
    </div>
  );
}
