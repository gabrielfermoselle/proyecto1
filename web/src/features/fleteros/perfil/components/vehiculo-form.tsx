"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, type DefaultValues } from "react-hook-form";
import type { z } from "zod";
import { FormField } from "@/components/shared/form-field";
import { FormMensaje } from "@/components/shared/form-mensaje";
import { RadioCard } from "@/components/shared/radio-card";
import { SubmitButton } from "@/components/shared/submit-button";
import { Button } from "@/components/ui/button";
import { ETIQUETA_VEHICULO, TIPOS_VEHICULO } from "@/domain/catalogos";
import { REFERENCIA_CAPACIDAD, VehiculoIcono } from "@/features/fleteros/components/vehiculo-icono";
import { useEnvio } from "@/lib/use-envio";
import { actualizarVehiculo, crearVehiculo } from "../actions";
import { vehiculoSchema, type VehiculoInput } from "../schemas";

/** Capacidad y volumen arrancan vacíos (no en 0) para que el fletero los complete. */
const VACIO: DefaultValues<VehiculoInput> = {
  tipo: "CAMIONETA",
  marca: "",
  modelo: "",
  anio: "",
  patente: "",
};

interface VehiculoFormProps {
  /** Si viene, se edita ese vehículo; si no, se crea uno nuevo. */
  vehiculo?: VehiculoInput & { id: string };
  onListo: () => void;
  onCancelar?: () => void;
}

export function VehiculoForm({ vehiculo, onListo, onCancelar }: VehiculoFormProps) {
  const {
    register,
    handleSubmit,
    getValues,
    setError,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<VehiculoInput, unknown, z.output<typeof vehiculoSchema>>({
    resolver: zodResolver(vehiculoSchema),
    defaultValues: vehiculo ?? VACIO,
  });
  const { mensaje, enviar } = useEnvio(setError);
  const tipo = watch("tipo");

  const onSubmit = handleSubmit(async () => {
    const datos = getValues();
    const resultado = await enviar(() =>
      vehiculo ? actualizarVehiculo({ ...datos, id: vehiculo.id }) : crearVehiculo(datos),
    );
    if (resultado) onListo();
  });

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-5 rounded-lg border bg-card p-4 sm:p-5">
      <h3 className="text-lg font-bold">{vehiculo ? "Editar vehículo" : "Agregar vehículo"}</h3>
      <FormMensaje mensaje={mensaje} />

      <fieldset className="grid gap-3">
        <legend className="mb-1 text-sm font-semibold">Tipo de vehículo</legend>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {TIPOS_VEHICULO.map((valor) => (
            <RadioCard
              key={valor}
              value={valor}
              title={ETIQUETA_VEHICULO[valor]}
              icon={<VehiculoIcono tipo={valor} />}
              className="p-3"
              {...register("tipo")}
            />
          ))}
        </div>
        {errors.tipo ? <p className="text-sm font-medium text-destructive">{errors.tipo.message}</p> : null}
      </fieldset>

      <div className="grid gap-5 sm:grid-cols-3">
        <FormField label="Marca" placeholder="Toyota" error={errors.marca?.message} {...register("marca")} />
        <FormField
          label="Modelo"
          placeholder="Hilux"
          error={errors.modelo?.message}
          {...register("modelo")}
        />
        <FormField
          label="Año (opcional)"
          type="number"
          inputMode="numeric"
          error={errors.anio?.message}
          {...register("anio")}
        />
      </div>

      <FormField
        label="Patente"
        autoCapitalize="characters"
        placeholder="AB123CD"
        className="uppercase"
        error={errors.patente?.message}
        {...register("patente")}
      />

      <div className="grid gap-5 sm:grid-cols-2">
        <FormField
          label="Capacidad de carga (kg)"
          type="number"
          inputMode="numeric"
          min={1}
          error={errors.capacidadKg?.message}
          {...register("capacidadKg")}
        />
        <FormField
          label="Volumen de carga (m³)"
          type="number"
          inputMode="decimal"
          min={0.01}
          step={0.01}
          hint="Largo × ancho × alto de la caja, en metros. Ej.: 2,5 × 1,6 × 1,2 = 4,8 m³."
          error={errors.volumenM3?.message}
          {...register("volumenM3")}
        />
      </div>
      <p className="-mt-2 text-sm text-muted-foreground">Referencia: {REFERENCIA_CAPACIDAD[tipo]}</p>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        {onCancelar ? (
          <Button type="button" variant="ghost" onClick={onCancelar}>
            Cancelar
          </Button>
        ) : null}
        <SubmitButton pending={isSubmitting} pendingLabel="Guardando…">
          {vehiculo ? "Guardar cambios" : "Agregar vehículo"}
        </SubmitButton>
      </div>
    </form>
  );
}
