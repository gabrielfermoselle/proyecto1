import { z } from "zod";
import { ROLES_REGISTRABLES } from "@/domain/roles";

// Schemas compartidos entre el formulario (zodResolver) y la Server Action.

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, "Ingresá tu email")
  .max(254, "El email es demasiado largo")
  .email("Ingresá un email válido");

/** bcrypt ignora lo que pase de 72 bytes: se limita para que no haya sorpresas. */
export const passwordSchema = z
  .string()
  .min(8, "Usá al menos 8 caracteres")
  .max(72, "Usá como máximo 72 caracteres")
  .regex(/[A-Za-zÁÉÍÓÚáéíóúÑñ]/, "Incluí al menos una letra")
  .regex(/\d/, "Incluí al menos un número");

export const nombreSchema = (campo: string) =>
  z
    .string()
    .trim()
    .min(2, `Ingresá tu ${campo}`)
    .max(60, `El ${campo} es demasiado largo`)
    .regex(/^[\p{L}' -]+$/u, `El ${campo} solo puede tener letras`);

/** Teléfono argentino opcional: se guardan solo los dígitos (p. ej. 3814112222). */
export const telefonoSchema = z
  .string()
  .trim()
  .transform((valor) => valor.replace(/[\s()+-]/g, ""))
  .refine(
    (digitos) => digitos === "" || /^\d{10,13}$/.test(digitos),
    "Ingresá el número con característica, ej. 381 411 2222",
  )
  .transform((digitos) => (digitos === "" ? null : digitos));

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Ingresá tu contraseña").max(72),
});

export const registroSchema = z
  .object({
    rol: z.enum(ROLES_REGISTRABLES, { errorMap: () => ({ message: "Elegí cómo vas a usar la plataforma" }) }),
    nombre: nombreSchema("nombre"),
    apellido: nombreSchema("apellido"),
    email: emailSchema,
    telefono: telefonoSchema,
    password: passwordSchema,
    confirmarPassword: z.string(),
  })
  .refine((datos) => datos.password === datos.confirmarPassword, {
    message: "Las contraseñas no coinciden",
    path: ["confirmarPassword"],
  });

export const cambioContrasenaSchema = z
  .object({
    actual: z.string().min(1, "Ingresá tu contraseña actual").max(72),
    nueva: passwordSchema,
    confirmar: z.string(),
  })
  .refine((d) => d.nueva === d.confirmar, { message: "Las contraseñas no coinciden", path: ["confirmar"] })
  .refine((d) => d.nueva !== d.actual, {
    message: "La nueva tiene que ser distinta de la actual",
    path: ["nueva"],
  });

export const solicitudRecuperacionSchema = z.object({ email: emailSchema });

/** El token viaja en el link: 32 bytes en base64url (43 caracteres). */
export const tokenRecuperacionSchema = z.string().regex(/^[A-Za-z0-9_-]{43}$/, "El link no es válido.");

export const restablecerSchema = z
  .object({ token: tokenRecuperacionSchema, nueva: passwordSchema, confirmar: z.string() })
  .refine((d) => d.nueva === d.confirmar, { message: "Las contraseñas no coinciden", path: ["confirmar"] });

export type LoginInput = z.input<typeof loginSchema>;
export type SolicitudRecuperacionInput = z.input<typeof solicitudRecuperacionSchema>;
export type RestablecerInput = z.input<typeof restablecerSchema>;
export type CambioContrasenaInput = z.input<typeof cambioContrasenaSchema>;
export type RegistroInput = z.input<typeof registroSchema>;
export type RegistroDatos = z.output<typeof registroSchema>;

/** Lo que recibe el formulario de login cuando se superan los intentos (NextAuth lo pasa en `error`). */
export const ERROR_DEMASIADOS_INTENTOS = "DEMASIADOS_INTENTOS";
