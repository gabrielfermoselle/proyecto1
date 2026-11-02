"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { MailCheck } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import type { z } from "zod";
import { FormField } from "@/components/shared/form-field";
import { FormMensaje } from "@/components/shared/form-mensaje";
import { SubmitButton } from "@/components/shared/submit-button";
import { Alert } from "@/components/ui/alert";
import { useEnvio } from "@/lib/use-envio";
import { solicitarRecuperacion } from "../actions";
import { solicitudRecuperacionSchema, type SolicitudRecuperacionInput } from "../schemas";

export function RecuperarForm() {
  const [enviadoA, setEnviadoA] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    getValues,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<SolicitudRecuperacionInput, unknown, z.output<typeof solicitudRecuperacionSchema>>({
    resolver: zodResolver(solicitudRecuperacionSchema),
  });
  const { mensaje, enviar } = useEnvio(setError);

  const onSubmit = handleSubmit(async (datos) => {
    if (await enviar(() => solicitarRecuperacion(getValues()))) setEnviadoA(datos.email);
  });

  if (enviadoA) {
    // Mismo mensaje exista o no la cuenta: no revela qué emails están registrados.
    return (
      <Alert variant="success" role="status">
        <MailCheck aria-hidden="true" />
        <p>
          Si hay una cuenta con <strong>{enviadoA}</strong>, te llega un email con un link para elegir una
          contraseña nueva. Vale 30 minutos. Revisá también la carpeta de spam.
        </p>
      </Alert>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-5">
      <FormMensaje mensaje={mensaje} />
      <FormField
        label="Email de tu cuenta"
        type="email"
        autoComplete="email"
        inputMode="email"
        error={errors.email?.message}
        {...register("email")}
      />
      <SubmitButton pending={isSubmitting} pendingLabel="Enviando…" className="w-full">
        Enviarme el link
      </SubmitButton>
    </form>
  );
}
