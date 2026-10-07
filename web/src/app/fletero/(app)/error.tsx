"use client";

import { ErrorSeccion } from "@/components/shared/error-seccion";

export default function ErrorFletero(props: { error: Error & { digest?: string }; reset: () => void }) {
  return <ErrorSeccion {...props} inicioHref="/fletero" />;
}
