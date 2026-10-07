"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useCallback, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import type { z } from "zod";
import { FormField } from "@/components/shared/form-field";
import { FormMensaje } from "@/components/shared/form-mensaje";
import { SubmitButton } from "@/components/shared/submit-button";
import type { Coordenadas } from "@/domain/geo";
import { AddressAutocomplete } from "@/features/mapas/components/address-autocomplete";
import { MapaPunto } from "@/features/mapas/components/mapas-dinamicos";
import { direccionDePunto } from "@/features/mapas/geocoding";
import { useEnvio } from "@/lib/use-envio";
import { guardarDireccionHabitual } from "../actions";
import { direccionHabitualSchema, type DireccionHabitualInput } from "../schemas";

interface DireccionHabitualFormProps {
  inicial: { direccionHabitual: string; lat: number | null; lng: number | null };
}

export function DireccionHabitualForm({ inicial }: DireccionHabitualFormProps) {
  const [punto, setPunto] = useState<Coordenadas | null>(
    inicial.lat !== null && inicial.lng !== null ? { lat: inicial.lat, lng: inicial.lng } : null,
  );
  const consultaInversa = useRef<AbortController | null>(null);

  const {
    register,
    handleSubmit,
    getValues,
    setValue,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<DireccionHabitualInput, unknown, z.output<typeof direccionHabitualSchema>>({
    resolver: zodResolver(direccionHabitualSchema),
    defaultValues: {
      direccionHabitual: inicial.direccionHabitual,
      ...(punto ? { lat: punto.lat, lng: punto.lng } : {}),
    },
  });
  const { mensaje, enviar } = useEnvio(setError);

  const fijarPunto = useCallback(
    (nuevo: Coordenadas, direccion?: string) => {
      setPunto(nuevo);
      setValue("lat", nuevo.lat);
      setValue("lng", nuevo.lng);
      if (direccion) {
        setValue("direccionHabitual", direccion, { shouldValidate: true });
        return;
      }
      // Pin movido a mano: se busca la dirección más cercana.
      consultaInversa.current?.abort();
      const controlador = new AbortController();
      consultaInversa.current = controlador;
      direccionDePunto(nuevo, controlador.signal)
        .then((encontrada) => {
          if (encontrada) setValue("direccionHabitual", encontrada, { shouldValidate: true });
        })
        .catch(() => undefined);
    },
    [setValue],
  );

  const onSubmit = handleSubmit(async () => {
    await enviar(() => guardarDireccionHabitual(getValues()), "Guardamos tu dirección.");
  });

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-5">
      <FormMensaje mensaje={mensaje} />
      <AddressAutocomplete
        label="Buscá tu dirección"
        placeholder="Ej.: Av. Roca 420"
        onSelect={({ lat, lng, direccion }) => fijarPunto({ lat, lng }, direccion)}
      />
      <MapaPunto punto={punto} onMover={fijarPunto} etiqueta="Mapa para marcar tu dirección habitual" />
      <FormField
        label="Dirección habitual"
        hint="La usamos para mostrarte primero los fleteros más cercanos. Nadie más la ve."
        error={errors.direccionHabitual?.message}
        {...register("direccionHabitual")}
      />
      <SubmitButton
        pending={isSubmitting}
        pendingLabel="Guardando…"
        className="w-full sm:w-auto sm:justify-self-end"
      >
        Guardar dirección
      </SubmitButton>
    </form>
  );
}
