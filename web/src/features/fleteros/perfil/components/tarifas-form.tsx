"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import type { z } from "zod";
import { FormField } from "@/components/shared/form-field";
import { FormMensaje } from "@/components/shared/form-mensaje";
import { SubmitButton } from "@/components/shared/submit-button";
import { Alert } from "@/components/ui/alert";
import { FACTOR_RUTA_URBANA } from "@/domain/geo";
import { ETIQUETA_PASO, type PasoOnboarding } from "@/domain/onboarding";
import { precioSugerido } from "@/domain/precio";
import { formatearM3, formatearPesos } from "@/lib/formato";
import { useEnvio } from "@/lib/use-envio";
import { guardarTarifas } from "../actions";
import { tarifasSchema, type TarifasInput } from "../schemas";

/** Ejemplos para que el fletero vea qué cobraría con sus tarifas antes de guardarlas. */
const EJEMPLOS = [
  { titulo: "Compra chica", kmRuta: 4, m3: 0.3, ayudantes: 0 },
  { titulo: "Mudanza de monoambiente", kmRuta: 8, m3: 4, ayudantes: 1 },
  { titulo: "Mudanza de casa", kmRuta: 15, m3: 18, ayudantes: 2 },
];

const aNumero = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : 0;
};

interface TarifasFormProps {
  inicial: TarifasInput;
  /** En el onboarding es el último paso: al completarlo se habilita la cuenta. */
  onboarding?: boolean;
}

export function TarifasForm({ inicial, onboarding = false }: TarifasFormProps) {
  const router = useRouter();
  const [pendientes, setPendientes] = useState<PasoOnboarding[]>([]);
  const {
    register,
    handleSubmit,
    getValues,
    setError,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<TarifasInput, unknown, z.output<typeof tarifasSchema>>({
    resolver: zodResolver(tarifasSchema),
    defaultValues: inicial,
  });
  const { mensaje, enviar } = useEnvio(setError);
  const valores = watch();
  const tarifas = {
    precioMinimo: aNumero(valores.precioMinimo),
    precioPorKm: aNumero(valores.precioPorKm),
    precioPorM3: aNumero(valores.precioPorM3),
    precioPorAyudante: aNumero(valores.precioPorAyudante),
  };

  const onSubmit = handleSubmit(async () => {
    const resultado = await enviar(
      () => guardarTarifas(getValues()),
      onboarding ? undefined : "Guardamos tus tarifas.",
    );
    if (!resultado || !onboarding) return;
    if (resultado.data.completo) {
      router.push("/fletero?bienvenida=1");
      router.refresh();
    } else {
      setPendientes(resultado.data.pendientes);
    }
  });

  const campoPesos = (nombre: keyof TarifasInput, label: string, hint: string) => (
    <FormField
      label={label}
      type="number"
      inputMode="numeric"
      min={0}
      step={100}
      hint={hint}
      error={errors[nombre]?.message}
      {...register(nombre)}
    />
  );

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-6">
      <FormMensaje mensaje={mensaje} />
      {pendientes.length > 0 ? (
        <Alert variant="destructive">
          <div className="grid gap-1">
            <p className="font-semibold">Guardamos tus tarifas, pero falta completar:</p>
            <ul className="list-inside list-disc">
              {pendientes.map((paso) => (
                <li key={paso}>
                  <Link href={`/fletero/onboarding/${paso}`} className="underline underline-offset-4">
                    {ETIQUETA_PASO[paso]}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </Alert>
      ) : null}

      <div className="grid gap-5 sm:grid-cols-2">
        {campoPesos(
          "precioMinimo",
          "Precio mínimo por flete ($)",
          "Lo menos que cobrás, aunque el viaje sea corto.",
        )}
        {campoPesos("precioPorKm", "Precio por km ($)", "Por cada km de recorrido.")}
        {campoPesos(
          "precioPorM3",
          "Precio por m³ de carga ($)",
          "Opcional. Dejalo en 0 si no cobrás por volumen.",
        )}
        {campoPesos(
          "precioPorAyudante",
          "Adicional por ayudante ($)",
          "Por cada ayudante que el cliente pida.",
        )}
      </div>

      <section aria-labelledby="vista-previa" className="rounded-lg border bg-muted/50 p-4">
        <h3 id="vista-previa" className="font-bold">
          Así quedarían tus precios sugeridos
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Es una sugerencia: en cada presupuesto vas a poder ajustar el monto.
        </p>
        <ul className="mt-3 grid gap-2">
          {EJEMPLOS.map(({ titulo, kmRuta, m3, ayudantes }) => (
            <li
              key={titulo}
              className="flex items-baseline justify-between gap-3 rounded-md bg-card px-3 py-2"
            >
              <span className="text-sm">
                <span className="font-semibold">{titulo}</span>
                <span className="block text-muted-foreground">
                  {kmRuta} km · {formatearM3(m3)}
                  {ayudantes > 0 ? ` · ${ayudantes} ayudante${ayudantes > 1 ? "s" : ""}` : ""}
                </span>
              </span>
              <span className="font-heading text-lg font-extrabold tabular-nums">
                {formatearPesos(
                  precioSugerido(
                    { distanciaLinealKm: kmRuta / FACTOR_RUTA_URBANA, volumenM3: m3, ayudantes },
                    tarifas,
                  ),
                )}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <SubmitButton
        pending={isSubmitting}
        pendingLabel="Guardando…"
        className="w-full sm:w-auto sm:justify-self-end"
      >
        {onboarding ? "Terminar y empezar a recibir solicitudes" : "Guardar tarifas"}
      </SubmitButton>
    </form>
  );
}
