"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { signOut } from "next-auth/react";
import { useForm } from "react-hook-form";
import type { z } from "zod";
import { FormField } from "@/components/shared/form-field";
import { FormMensaje } from "@/components/shared/form-mensaje";
import { SubmitButton } from "@/components/shared/submit-button";
import { useEnvio } from "@/lib/use-envio";
import { cambiarContrasena } from "../actions";
import { cambioContrasenaSchema, type CambioContrasenaInput } from "../schemas";

/** Al cambiarla se cierran todas las sesiones: se vuelve al login para entrar con la nueva. */
export function CambiarContrasenaForm() {
  const {
    register,
    handleSubmit,
    getValues,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<CambioContrasenaInput, unknown, z.output<typeof cambioContrasenaSchema>>({
    resolver: zodResolver(cambioContrasenaSchema),
    defaultValues: { actual: "", nueva: "", confirmar: "" },
  });
  const { mensaje, enviar } = useEnvio(setError);

  const onSubmit = handleSubmit(async () => {
    const resultado = await enviar(() => cambiarContrasena(getValues()));
    if (resultado) await signOut({ callbackUrl: "/login?aviso=contrasena" });
  });

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-5">
      <FormMensaje mensaje={mensaje} />
      <FormField
        label="Contraseña actual"
        type="password"
        autoComplete="current-password"
        error={errors.actual?.message}
        {...register("actual")}
      />
      <div className="grid gap-5 sm:grid-cols-2">
        <FormField
          label="Contraseña nueva"
          type="password"
          autoComplete="new-password"
          hint="Al menos 8 caracteres, con una letra y un número."
          error={errors.nueva?.message}
          {...register("nueva")}
        />
        <FormField
          label="Repetí la nueva"
          type="password"
          autoComplete="new-password"
          error={errors.confirmar?.message}
          {...register("confirmar")}
        />
      </div>
      <SubmitButton
        pending={isSubmitting}
        pendingLabel="Cambiando…"
        className="w-full sm:w-auto sm:justify-self-end"
      >
        Cambiar contraseña
      </SubmitButton>
    </form>
  );
}
