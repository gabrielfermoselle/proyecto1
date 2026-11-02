"use client";

import { AlertTriangle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useTransition } from "react";
import { PantallaError } from "@/components/shared/pantalla-error";
import { Button } from "@/components/ui/button";

// Pantalla de error de un área (cliente, fletero, admin, comunes, login y la parte pública). Se
// muestra dentro del layout de cada una, así que
// la navegación sigue disponible. El código ("digest") es el que Next registra en el servidor
// junto al error real: sirve para encontrarlo en los logs sin mostrarle detalles al usuario.

interface ErrorSeccionVistaProps {
  codigo: string | undefined;
  inicioHref: string;
  reintentando?: boolean;
  onReintentar?: () => void;
}

/** Solo presentación (sin hooks): se puede renderizar en un test. */
export function ErrorSeccionVista({ codigo, inicioHref, reintentando = false, onReintentar }: ErrorSeccionVistaProps) {
  return (
    <div role="alert">
      <PantallaError
        icono={<AlertTriangle />}
        titulo="No pudimos cargar esta sección"
        descripcion={
          <>
            <p>
              Puede ser un problema de conexión. Probá de nuevo; si sigue fallando, volvé a intentar en unos
              minutos.
            </p>
            {codigo ? (
              <p className="mt-3 text-sm">
                Si nos escribís, mencioná este código:{" "}
                <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-foreground">{codigo}</code>
              </p>
            ) : null}
          </>
        }
        acciones={
          <>
            <Button onClick={onReintentar} disabled={reintentando}>
              {reintentando ? "Reintentando…" : "Reintentar"}
            </Button>
            <Button asChild variant="outline">
              <Link href={inicioHref}>Ir al inicio</Link>
            </Button>
          </>
        }
      />
    </div>
  );
}

export function ErrorSeccion({
  error,
  reset,
  inicioHref,
}: {
  error: Error & { digest?: string };
  reset: () => void;
  inicioHref: string;
}) {
  const router = useRouter();
  const [reintentando, iniciar] = useTransition();

  useEffect(() => {
    // En el navegador: el detalle del error ya quedó en los logs del servidor con este digest.
    console.error("[ui] error en la sección", error.digest ?? error.message);
  }, [error]);

  return (
    <ErrorSeccionVista
      codigo={error.digest}
      inicioHref={inicioHref}
      reintentando={reintentando}
      // Los errores de Server Components se reintentan pidiendo los datos de nuevo al servidor.
      onReintentar={() =>
        iniciar(() => {
          router.refresh();
          reset();
        })
      }
    />
  );
}
