import { cn } from "@/lib/utils";

interface PantallaErrorProps {
  /** Ícono del corte: qué se rompió (una dirección que no existe, una carga que falló). */
  icono: React.ReactNode;
  /** Código grande y opcional sobre el título (p. ej. 404). */
  codigo?: string;
  titulo: string;
  descripcion: React.ReactNode;
  acciones: React.ReactNode;
  className?: string;
}

/**
 * Pantallas de error y de "no encontrado": la ruta punteada de la marca sale del origen y se corta
 * donde está el problema. Explican qué pasó y ofrecen siempre una salida.
 */
export function PantallaError({ icono, codigo, titulo, descripcion, acciones, className }: PantallaErrorProps) {
  return (
    <div className={cn("mx-auto grid w-full max-w-xl justify-items-center gap-6 py-10 text-center sm:py-16", className)}>
      <div aria-hidden="true" className="grid w-full max-w-xs grid-cols-[auto_1fr_auto_1fr] items-center gap-2">
        <span className="size-3 rounded-full bg-primary ring-4 ring-primary/15" />
        <span className="ruta-punteada h-0.5 text-primary/40" />
        <span className="grid size-14 place-items-center rounded-2xl bg-card text-destructive shadow-md ring-1 ring-border [&_svg]:size-7">
          {icono}
        </span>
        <span className="ruta-punteada h-0.5 text-border" />
      </div>
      <div className="grid gap-3">
        {codigo ? (
          <p className="font-heading text-6xl font-extrabold tracking-tight text-primary sm:text-7xl">{codigo}</p>
        ) : null}
        <h1 className="text-2xl font-extrabold sm:text-3xl">{titulo}</h1>
        <div className="mx-auto max-w-md text-muted-foreground">{descripcion}</div>
      </div>
      <div className="flex flex-wrap justify-center gap-2">{acciones}</div>
    </div>
  );
}
