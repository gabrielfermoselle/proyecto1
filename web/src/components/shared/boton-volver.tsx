"use client";

import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

/** Vuelve a la página anterior; si se entró directo (sin historial), va al inicio. */
export function BotonVolver() {
  const router = useRouter();
  return (
    <Button
      variant="outline"
      onClick={() => (window.history.length > 1 ? router.back() : router.push("/"))}
    >
      <ArrowLeft aria-hidden="true" />
      Volver
    </Button>
  );
}
