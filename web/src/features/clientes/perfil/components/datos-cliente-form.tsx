"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import type { z } from "zod";
import { FormField } from "@/components/shared/form-field";
import { FormMensaje } from "@/components/shared/form-mensaje";
import { SubmitButton } from "@/components/shared/submit-button";
import { useEnvio } from "@/lib/use-envio";
import { guardarDatosCliente } from "../actions";
import { datosClienteSchema, type DatosClienteInput } from "../schemas";

export function DatosClienteForm({ inicial }: { inicial: DatosClienteInput }) {
  const {
    register,
    handleSubmit,
    getValues,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<DatosClienteInput, unknown, z.output<typeof datosClienteSchema>>({
    resolver: zodResolver(datosClienteSchema),
    defaultValues: inicial,
  });
  const { mensaje, enviar } = useEnvio(setError);

  const onSubmit = handleSubmit(async () => {
    await enviar(() => guardarDatosCliente(getValues()), "Guardamos tus datos.");
  });

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-5">
      <FormMensaje mensaje={mensaje} />
      <div className="grid gap-5 sm:grid-cols-2">
        <FormField
          label="Nombre"
          autoComplete="given-name"
          error={errors.nombre?.message}
          {...register("nombre")}
        />
        <FormField
          label="Apellido"
          autoComplete="family-name"
          error={errors.apellido?.message}
          {...register("apellido")}
        />
      </div>
      <FormField
        label="Teléfono (opcional)"
        type="tel"
        inputMode="tel"
        autoComplete="tel-national"
        hint="Solo para avisos importantes. Los fleteros no lo ven hasta que confirmás un flete."
        error={errors.telefono?.message}
        {...register("telefono")}
      />
      <SubmitButton
        pending={isSubmitting}
        pendingLabel="Guardando…"
        className="w-full sm:w-auto sm:justify-self-end"
      >
        Guardar cambios
      </SubmitButton>
    </form>
  );
}
