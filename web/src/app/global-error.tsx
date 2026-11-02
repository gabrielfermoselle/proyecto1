"use client";

import { AlertTriangle } from "lucide-react";
import { useEffect } from "react";
import { PantallaError } from "@/components/shared/pantalla-error";
import { Button } from "@/components/ui/button";
import "./globals.css";

/**
 * Último recurso: se rompió el layout raíz, así que esta pantalla trae su propio <html>. Usa un
 * <a> y no <Link>, y recarga la página entera: el estado de la app ya no es confiable.
 */
export default function ErrorGlobal({ error }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[ui] error global", error.digest ?? error.message);
  }, [error]);

  return (
    <html lang="es-AR">
      <body className="min-h-dvh bg-background font-sans text-foreground antialiased">
        <header className="toldo bg-secondary text-secondary-foreground">
          <div className="container flex h-16 items-center font-heading text-lg font-extrabold">
            Fletes Tucumán
          </div>
        </header>
        <main id="contenido" className="container">
          <div role="alert">
            <PantallaError
              icono={<AlertTriangle />}
              titulo="Algo se rompió de nuestro lado"
              descripcion={
                <>
                  <p>No es algo que hayas hecho vos. Recargá la página; si sigue igual, probá en unos minutos.</p>
                  {error.digest ? (
                    <p className="mt-3 text-sm">
                      Si nos escribís, mencioná este código:{" "}
                      <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-foreground">{error.digest}</code>
                    </p>
                  ) : null}
                </>
              }
              acciones={
                <>
                  <Button onClick={() => window.location.reload()}>Recargar la página</Button>
                  <Button asChild variant="outline">
                    {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- recarga completa a propósito */}
                    <a href="/">Ir al inicio</a>
                  </Button>
                </>
              }
            />
          </div>
        </main>
      </body>
    </html>
  );
}
