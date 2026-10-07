import { Check } from "lucide-react";
import Link from "next/link";
import { ETIQUETA_PASO, PASOS_ONBOARDING, type PasoOnboarding } from "@/domain/onboarding";
import { cn } from "@/lib/utils";

interface OnboardingStepperProps {
  actual: PasoOnboarding;
  completos: Record<PasoOnboarding, boolean>;
}

export function OnboardingStepper({ actual, completos }: OnboardingStepperProps) {
  const indiceActual = PASOS_ONBOARDING.indexOf(actual);
  return (
    <nav aria-label="Pasos para configurar tu perfil">
      <p className="mb-3 text-sm font-semibold text-muted-foreground sm:hidden">
        Paso {indiceActual + 1} de {PASOS_ONBOARDING.length}: {ETIQUETA_PASO[actual]}
      </p>
      <ol className="grid grid-cols-4 gap-2">
        {PASOS_ONBOARDING.map((paso, i) => {
          const esActual = paso === actual;
          const completo = completos[paso];
          const contenido = (
            <>
              <span
                className={cn(
                  "h-1.5 w-full rounded-full",
                  esActual ? "bg-primary" : completo ? "bg-success" : "bg-muted",
                )}
                aria-hidden="true"
              />
              <span className="hidden items-center gap-1.5 text-sm font-semibold sm:flex">
                {completo && !esActual ? <Check className="size-4 text-success" aria-hidden="true" /> : null}
                <span className={cn(!esActual && "text-muted-foreground")}>
                  {i + 1}. {ETIQUETA_PASO[paso]}
                </span>
              </span>
              <span className="sr-only">
                {ETIQUETA_PASO[paso]}
                {completo ? " (completo)" : ""}
              </span>
            </>
          );
          return (
            <li key={paso}>
              {esActual ? (
                <span aria-current="step" className="grid gap-2">
                  {contenido}
                </span>
              ) : (
                <Link
                  href={`/fletero/onboarding/${paso}`}
                  className="grid gap-2 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {contenido}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
