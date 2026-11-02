"use client";

import { ErrorSeccion } from "@/components/shared/error-seccion";

// Errores de la parte pública (portada, perfil público de un fletero). El layout raíz sigue en pie.
export default function ErrorPublico(props: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main id="contenido" className="container flex min-h-dvh items-center">
      <ErrorSeccion {...props} inicioHref="/" />
    </main>
  );
}
