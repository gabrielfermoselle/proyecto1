"use client";

import { ErrorSeccion } from "@/components/shared/error-seccion";

// Login, registro y recuperación de contraseña.
export default function ErrorAuth(props: { error: Error & { digest?: string }; reset: () => void }) {
  return <ErrorSeccion {...props} inicioHref="/" />;
}
