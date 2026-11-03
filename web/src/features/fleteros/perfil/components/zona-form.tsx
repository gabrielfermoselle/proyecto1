"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { LocateFixed, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import type { z } from "zod";
import { FormMensaje } from "@/components/shared/form-mensaje";
import { SubmitButton } from "@/components/shared/submit-button";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { estaEnRegion, type Coordenadas } from "@/domain/geo";
import { AddressAutocomplete } from "@/features/mapas/components/address-autocomplete";
import { ErrorPunto } from "@/features/mapas/components/error-punto";
import { MapaZona } from "@/features/mapas/components/mapas-dinamicos";
import { direccionDePunto } from "@/features/mapas/geocoding";
import { cn } from "@/lib/utils";
import { useEnvio } from "@/lib/use-envio";
import { guardarZona } from "../actions";
import { zonaSchema, type ZonaInput } from "../schemas";

const RADIOS_RAPIDOS = [5, 10, 20, 40];

interface ZonaFormProps {
  inicial: {
    baseDireccion: string;
    baseLat: number | null;
    baseLng: number | null;
    radioCoberturaKm: number;
  };
  siguienteHref?: string;
}

export function ZonaForm({ inicial, siguienteHref }: ZonaFormProps) {
  const router = useRouter();
  const [punto, setPunto] = useState<Coordenadas | null>(
    inicial.baseLat !== null && inicial.baseLng !== null
      ? { lat: inicial.baseLat, lng: inicial.baseLng }
      : null,
  );
  const [ubicando, setUbicando] = useState(false);
  const [avisoUbicacion, setAvisoUbicacion] = useState<string | null>(null);
  const consultaInversa = useRef<AbortController | null>(null);
  const conservarDireccion = useRef(false);

  const {
    control,
    register,
    handleSubmit,
    getValues,
    setValue,
    setError,
    clearErrors,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ZonaInput, unknown, z.output<typeof zonaSchema>>({
    resolver: zodResolver(zonaSchema),
    defaultValues: {
      baseDireccion: inicial.baseDireccion,
      radioCoberturaKm: inicial.radioCoberturaKm,
      ...(punto ? { baseLat: punto.lat, baseLng: punto.lng } : {}),
    },
  });
  const { mensaje, enviar } = useEnvio(setError);
  const radio = Number(watch("radioCoberturaKm")) || 1;

  const fijarPunto = useCallback(
    (nuevo: Coordenadas, direccion?: string) => {
      setPunto(nuevo);
      setValue("baseLat", nuevo.lat);
      setValue("baseLng", nuevo.lng);
      clearErrors(["baseLat", "baseLng"]);
      if (direccion) {
        setValue("baseDireccion", direccion, { shouldValidate: true });
        return;
      }
      // Si el texto lo escribió el usuario o la altura es aproximada, mover el pin ajusta el punto
      // pero no reemplaza la dirección.
      if (conservarDireccion.current && getValues("baseDireccion").trim()) return;
      // Sin dirección (pin arrastrado o ubicación del GPS): se busca la más cercana.
      consultaInversa.current?.abort();
      const controlador = new AbortController();
      consultaInversa.current = controlador;
      direccionDePunto(nuevo, controlador.signal)
        .then((encontrada) => {
          if (encontrada) setValue("baseDireccion", encontrada, { shouldValidate: true });
        })
        .catch(() => undefined);
    },
    [setValue, getValues, clearErrors],
  );

  function usarMiUbicacion() {
    if (!("geolocation" in navigator)) {
      setAvisoUbicacion(
        "Tu navegador no permite obtener la ubicación. Buscá la dirección o marcala en el mapa.",
      );
      return;
    }
    setUbicando(true);
    setAvisoUbicacion(null);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setUbicando(false);
        const actual = { lat: coords.latitude, lng: coords.longitude };
        if (!estaEnRegion(actual)) {
          setAvisoUbicacion("Tu ubicación actual está fuera de Tucumán. Buscá la dirección de tu base.");
          return;
        }
        conservarDireccion.current = false;
        fijarPunto(actual);
      },
      () => {
        setUbicando(false);
        setAvisoUbicacion("No pudimos obtener tu ubicación. Revisá los permisos o buscá la dirección.");
      },
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  }

  const onSubmit = handleSubmit(async () => {
    const resultado = await enviar(
      () => guardarZona(getValues()),
      siguienteHref ? undefined : "Guardamos tu zona de trabajo.",
    );
    if (!resultado) return;
    // Si el refresco que pide la acción se descarta, el listado de pedidos seguiría con la zona vieja.
    if (siguienteHref) router.push(siguienteHref);
    else router.refresh();
  });

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-5">
      <FormMensaje mensaje={mensaje} />

      <div className="grid gap-3">
        <Controller
          control={control}
          name="baseDireccion"
          render={({ field, fieldState }) => (
            <AddressAutocomplete
              label="Dirección de tu base"
              placeholder="Ej.: Av. Salta 650, Barrio Norte"
              hint="Para una búsqueda óptima, poné calle, número y barrio. Los clientes ven solo el barrio, nunca la dirección exacta."
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
        <Button
          type="button"
          variant="outline"
          onClick={usarMiUbicacion}
          disabled={ubicando}
          className="justify-self-start"
        >
          {ubicando ? (
            <Loader2 className="animate-spin" aria-hidden="true" />
          ) : (
            <LocateFixed aria-hidden="true" />
          )}
          Usar mi ubicación
        </Button>
      </div>
      {avisoUbicacion ? (
        <p role="status" className="text-sm text-warning">
          {avisoUbicacion}
        </p>
      ) : null}

      <div className="grid gap-2">
        <MapaZona punto={punto} radioKm={radio} onMover={fijarPunto} />
        {errors.baseLat || errors.baseLng ? <ErrorPunto /> : null}
        <p className="text-sm text-muted-foreground">
          Tocá el mapa o arrastrá el pin para ajustar el punto. El círculo es la zona donde vas a ver
          solicitudes.
        </p>
      </div>

      <fieldset className="grid gap-3">
        <legend className="text-sm font-semibold">Radio de cobertura</legend>
        <div className="flex items-center gap-4">
          <Label htmlFor="radioCoberturaKm" className="sr-only">
            Radio de cobertura en km
          </Label>
          <input
            id="radioCoberturaKm"
            type="range"
            min={1}
            max={100}
            step={1}
            aria-valuetext={`${radio} km`}
            className="h-11 flex-1 accent-[hsl(var(--primary))]"
            {...register("radioCoberturaKm", { valueAsNumber: true })}
          />
          <output
            htmlFor="radioCoberturaKm"
            className="w-16 text-right font-heading text-xl font-extrabold tabular-nums"
          >
            {radio} km
          </output>
        </div>
        <div className="flex flex-wrap gap-2">
          {RADIOS_RAPIDOS.map((km) => (
            <Button
              key={km}
              type="button"
              size="sm"
              variant="outline"
              aria-pressed={radio === km}
              className={cn(radio === km && "border-primary bg-primary/5")}
              onClick={() => setValue("radioCoberturaKm", km, { shouldValidate: true })}
            >
              {km} km
            </Button>
          ))}
        </div>
        {errors.radioCoberturaKm ? (
          <p className="text-sm font-medium text-destructive">{errors.radioCoberturaKm.message}</p>
        ) : null}
      </fieldset>

      <SubmitButton
        pending={isSubmitting}
        pendingLabel="Guardando…"
        className="w-full sm:w-auto sm:justify-self-end"
      >
        {siguienteHref ? "Guardar y continuar" : "Guardar zona"}
      </SubmitButton>
    </form>
  );
}
