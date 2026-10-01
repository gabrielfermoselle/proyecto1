"use client";

import { AlertTriangle } from "lucide-react";
import { useEffect } from "react";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";

export default function ErrorFletero({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <EmptyState
      icon={<AlertTriangle />}
      title="No pudimos cargar esta sección"
      description="Puede ser un problema de conexión. Probá de nuevo; si sigue fallando, volvé a intentar en unos minutos."
      action={<Button onClick={reset}>Reintentar</Button>}
    />
  );
}
