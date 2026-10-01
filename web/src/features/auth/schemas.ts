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

const nombreSchema = (campo: string) =>
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

export type LoginInput = z.input<typeof loginSchema>;
export type RegistroInput = z.input<typeof registroSchema>;
export type RegistroDatos = z.output<typeof registroSchema>;
