"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useCallback, useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import type { z } from "zod";
import { FormMensaje } from "@/components/shared/form-mensaje";
import { SubmitButton } from "@/components/shared/submit-button";
import type { Coordenadas } from "@/domain/geo";
import { AddressAutocomplete } from "@/features/mapas/components/address-autocomplete";
import { ErrorPunto } from "@/features/mapas/components/error-punto";
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
  const conservarDireccion = useRef(false);

  const {
    control,
    handleSubmit,
    getValues,
    setValue,
    setError,
    clearErrors,
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
      clearErrors(["lat", "lng"]);
      if (direccion) {
        setValue("direccionHabitual", direccion, { shouldValidate: true });
        return;
      }
      // Si el texto lo escribió el usuario o la altura es aproximada, mover el pin ajusta el punto
      // pero no reemplaza la dirección.
      if (conservarDireccion.current && getValues("direccionHabitual").trim()) return;
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
    [setValue, getValues, clearErrors],
  );

  const onSubmit = handleSubmit(async () => {
    await enviar(() => guardarDireccionHabitual(getValues()), "Guardamos tu dirección.");
  });

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-5">
      <FormMensaje mensaje={mensaje} />
      <Controller
        control={control}
        name="direccionHabitual"
        render={({ field, fieldState }) => (
          <AddressAutocomplete
            label="Dirección habitual"
            placeholder="Ej.: Av. Roca 420, Barrio Sur"
            hint="Para una búsqueda óptima, poné calle, número y barrio. La usamos para mostrarte primero los fleteros más cercanos. Nadie más la ve."
            name={field.name}
            value={field.value ?? ""}
            onTextoChange={(texto) => {
              conservarDireccion.current = true;
              field.onChange(texto);
            }}
            onBlur={field.onBlur}
            inputRef={field.ref}
            error={fieldState.error?.message}
            onSelect={({ lat, lng, direccion, aproximada }) => {
              conservarDireccion.current = aproximada;
              fijarPunto({ lat, lng }, direccion);
            }}
          />
        )}
      />
      <MapaPunto punto={punto} onMover={fijarPunto} etiqueta="Mapa para marcar tu dirección habitual" />
      {errors.lat || errors.lng ? <ErrorPunto /> : null}
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
