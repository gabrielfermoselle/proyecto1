"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle, Package, Truck } from "lucide-react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { FormField } from "@/components/shared/form-field";
import { SubmitButton } from "@/components/shared/submit-button";
import { Alert } from "@/components/ui/alert";
import type { RolRegistrable } from "@/domain/roles";
import { cn } from "@/lib/utils";
import { registrarUsuario } from "../actions";
import { registroSchema, type RegistroDatos, type RegistroInput } from "../schemas";
import { rutaDePanel } from "../rutas";

const OPCIONES_ROL: { valor: RolRegistrable; titulo: string; detalle: string; Icono: typeof Truck }[] = [
  {
    valor: "CLIENTE",
    titulo: "Necesito un flete",
    detalle: "Publicá lo que querés llevar y compará presupuestos.",
    Icono: Package,
  },
  {
    valor: "FLETERO",
    titulo: "Soy fletero",
    detalle: "Recibí pedidos cerca tuyo y enviá presupuestos.",
    Icono: Truck,
  },
];

export function RegistroForm({ rolInicial }: { rolInicial?: RolRegistrable | undefined }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    getValues,
    setError: setFieldError,
    formState: { errors, isSubmitting },
  } = useForm<RegistroInput, unknown, RegistroDatos>({
    resolver: zodResolver(registroSchema),
    defaultValues: { ...(rolInicial ? { rol: rolInicial } : {}), telefono: "" },
  });

  const onSubmit = handleSubmit(async () => {
    setError(null);
    // La action vuelve a validar con el mismo schema: se le manda el input crudo, no el transformado.
    const input = getValues();
    const resultado = await registrarUsuario(input);
    if (!resultado.ok) {
      setError(resultado.error);
      for (const [campo, mensajes] of Object.entries(resultado.fieldErrors ?? {})) {
        const mensaje = mensajes?.[0];
        if (mensaje) setFieldError(campo as keyof RegistroInput, { message: mensaje });
      }
      return;
    }

    const login = await signIn("credentials", {
      email: input.email,
      password: input.password,
      redirect: false,
    });
    router.replace(login?.ok ? rutaDePanel() : "/login");
    router.refresh();
  });

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-5">
      {error ? (
        <Alert variant="destructive">
          <AlertCircle aria-hidden="true" />
          <p>{error}</p>
        </Alert>
      ) : null}

      <fieldset className="grid gap-3" aria-describedby={errors.rol ? "rol-error" : undefined}>
        <legend className="mb-1 text-sm font-semibold">¿Cómo vas a usar Fletes Tucumán?</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          {OPCIONES_ROL.map(({ valor, titulo, detalle, Icono }) => (
            <label
              key={valor}
              className={cn(
                "flex cursor-pointer gap-3 rounded-lg border-2 border-input bg-card p-4 transition-colors",
                "hover:border-primary/50 has-[:checked]:border-primary has-[:checked]:bg-primary/5",
                "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring has-[:focus-visible]:ring-offset-2",
              )}
            >
              <input type="radio" value={valor} className="sr-only" {...register("rol")} />
              <Icono className="mt-0.5 size-6 shrink-0 text-primary" aria-hidden="true" />
              <span className="grid gap-1">
                <span className="font-semibold">{titulo}</span>
                <span className="text-sm text-muted-foreground">{detalle}</span>
              </span>
            </label>
          ))}
        </div>
        {errors.rol ? (
          <p id="rol-error" className="text-sm font-medium text-destructive">
            {errors.rol.message}
          </p>
        ) : null}
      </fieldset>

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
        label="Email"
        type="email"
        autoComplete="email"
        inputMode="email"
        error={errors.email?.message}
        {...register("email")}
      />
      <FormField
        label="Teléfono (opcional)"
        type="tel"
        autoComplete="tel-national"
        inputMode="tel"
        hint="No se muestra a nadie: la coordinación es por el chat de la plataforma."
        error={errors.telefono?.message}
        {...register("telefono")}
      />
      <div className="grid gap-5 sm:grid-cols-2">
        <FormField
          label="Contraseña"
          type="password"
          autoComplete="new-password"
          hint="Mínimo 8 caracteres, con letras y números."
          error={errors.password?.message}
          {...register("password")}
        />
        <FormField
          label="Repetí la contraseña"
          type="password"
          autoComplete="new-password"
          error={errors.confirmarPassword?.message}
          {...register("confirmarPassword")}
        />
      </div>
      <SubmitButton pending={isSubmitting} pendingLabel="Creando tu cuenta…" className="w-full">
        Crear cuenta
      </SubmitButton>
    </form>
  );
}
