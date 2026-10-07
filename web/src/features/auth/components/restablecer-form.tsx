"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import type { z } from "zod";
import { FormField } from "@/components/shared/form-field";
import { FormMensaje } from "@/components/shared/form-mensaje";
import { SubmitButton } from "@/components/shared/submit-button";
import { useEnvio } from "@/lib/use-envio";
import { restablecerContrasena } from "../actions";
import { restablecerSchema, type RestablecerInput } from "../schemas";

export function RestablecerForm({ token }: { token: string }) {
  const router = useRouter();
  const {
    register,
    handleSubmit,
    getValues,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<RestablecerInput, unknown, z.output<typeof restablecerSchema>>({
    resolver: zodResolver(restablecerSchema),
    defaultValues: { token, nueva: "", confirmar: "" },
  });
  const { mensaje, enviar } = useEnvio(setError);

  const onSubmit = handleSubmit(async () => {
    if (await enviar(() => restablecerContrasena(getValues()))) router.replace("/login?aviso=recuperada");
  });

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-5">
      <FormMensaje mensaje={mensaje} />
      <input type="hidden" {...register("token")} />
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
      <SubmitButton pending={isSubmitting} pendingLabel="Guardando…" className="w-full">
        Guardar contraseña
      </SubmitButton>
    </form>
  );
}
