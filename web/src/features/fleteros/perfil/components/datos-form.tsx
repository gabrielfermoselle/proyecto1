"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import type { z } from "zod";
import { FormField, TextareaField } from "@/components/shared/form-field";
import { FormMensaje } from "@/components/shared/form-mensaje";
import { SubmitButton } from "@/components/shared/submit-button";
import { useEnvio } from "@/lib/use-envio";
import { guardarDatos } from "../actions";
import { datosSchema, type DatosInput } from "../schemas";

interface DatosFormProps {
  inicial: DatosInput;
  /** En el onboarding, adónde ir al guardar. En el perfil se muestra "Guardado". */
  siguienteHref?: string;
}

export function DatosForm({ inicial, siguienteHref }: DatosFormProps) {
  const router = useRouter();
  const {
    register,
    handleSubmit,
    getValues,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<DatosInput, unknown, z.output<typeof datosSchema>>({
    resolver: zodResolver(datosSchema),
    defaultValues: inicial,
  });
  const { mensaje, enviar } = useEnvio(setError);

  const onSubmit = handleSubmit(async () => {
    const resultado = await enviar(
      () => guardarDatos(getValues()),
      siguienteHref ? undefined : "Guardamos tus datos.",
    );
    if (resultado && siguienteHref) router.push(siguienteHref);
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
      <div className="grid gap-5 sm:grid-cols-2">
        <FormField
          label="Teléfono"
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          hint="Solo para avisarte. Los clientes no lo ven."
          error={errors.telefono?.message}
          {...register("telefono")}
        />
        <FormField
          label="DNI"
          inputMode="numeric"
          hint="Sin puntos. Lo usamos para verificar tu identidad."
          error={errors.dni?.message}
          {...register("dni")}
        />
      </div>
      <TextareaField
        label="Presentación (opcional)"
        rows={4}
        maxLength={500}
        placeholder="Ej.: Hago mudanzas y fletes en toda la capital. Llevo mantas y sogas."
        hint="Aparece en tu perfil público. Contá qué tipo de fletes hacés y por qué elegirte."
        error={errors.bio?.message}
        {...register("bio")}
      />
      <SubmitButton
        pending={isSubmitting}
        pendingLabel="Guardando…"
        className="w-full sm:w-auto sm:justify-self-end"
      >
        {siguienteHref ? "Guardar y continuar" : "Guardar cambios"}
      </SubmitButton>
    </form>
  );
}
