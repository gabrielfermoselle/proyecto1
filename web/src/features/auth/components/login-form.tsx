"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import type { z } from "zod";
import { FormField } from "@/components/shared/form-field";
import { SubmitButton } from "@/components/shared/submit-button";
import { Alert } from "@/components/ui/alert";
import { loginSchema, type LoginInput } from "../schemas";
import { rutaDePanel } from "../rutas";

export function LoginForm({ callbackUrl }: { callbackUrl?: string | undefined }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput, unknown, z.output<typeof loginSchema>>({ resolver: zodResolver(loginSchema) });

  const onSubmit = handleSubmit(async (datos) => {
    setError(null);
    try {
      const respuesta = await signIn("credentials", { ...datos, redirect: false });
      if (!respuesta?.ok) {
        setError("El email o la contraseña no son correctos.");
        return;
      }
      router.replace(rutaDePanel(callbackUrl));
      router.refresh();
    } catch {
      setError("No pudimos conectarnos. Revisá tu conexión y probá de nuevo.");
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-5">
      {error ? (
        <Alert variant="destructive">
          <AlertCircle aria-hidden="true" />
          <p>{error}</p>
        </Alert>
      ) : null}
      <FormField
        label="Email"
        type="email"
        autoComplete="email"
        inputMode="email"
        error={errors.email?.message}
        {...register("email")}
      />
      <FormField
        label="Contraseña"
        type="password"
        autoComplete="current-password"
        error={errors.password?.message}
        {...register("password")}
      />
      <SubmitButton pending={isSubmitting} pendingLabel="Ingresando…" className="w-full">
        Ingresar
      </SubmitButton>
    </form>
  );
}
