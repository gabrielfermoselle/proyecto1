"use client";

import { ErrorSeccion } from "@/components/shared/error-seccion";

// Chat, notificaciones y Mi cuenta: "/panel" lleva al inicio del rol de cada uno.
export default function ErrorComun(props: { error: Error & { digest?: string }; reset: () => void }) {
  return <ErrorSeccion {...props} inicioHref="/panel" />;
}
