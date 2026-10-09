import "server-only";
import { z } from "zod";

const opcional = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v ? v : undefined));

// Falla al arrancar, con un mensaje claro, si falta una variable de entorno.
const envSchema = z
  .object({
    // Postgres directo (Prisma). Opcional: la app lee y escribe por el cliente de Supabase.
    DATABASE_URL: opcional.pipe(z.string().url().optional()),
    DIRECT_URL: opcional.pipe(z.string().url().optional()),
    NEXTAUTH_SECRET: z.string().min(32, "NEXTAUTH_SECRET debe tener al menos 32 caracteres"),
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    // Datos: SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY. Realtime y Storage, si están,
    // suman SUPABASE_ANON_KEY y SUPABASE_JWT_SECRET.
    SUPABASE_URL: opcional.pipe(z.string().url().optional()),
    SUPABASE_ANON_KEY: opcional,
    SUPABASE_SERVICE_ROLE_KEY: opcional,
    SUPABASE_JWT_SECRET: opcional,
    // Lo manda Vercel Cron en Authorization. Sin él, el mantenimiento diario no se puede disparar.
    CRON_SECRET: opcional.pipe(z.string().min(16).optional()),
    // URL pública: arma los links de los emails (nunca se toma del header Host, que lo manda el
    // navegador). En Vercel, sin NEXTAUTH_URL se usa la del deploy (VERCEL_URL).
    NEXTAUTH_URL: opcional.pipe(z.string().url().optional()),
    VERCEL_URL: opcional,
    // Emails (recuperar contraseña) con Resend. Sin clave, el link se muestra en la consola
    // (solo fuera de producción). CORREO_ARCHIVO lo usan los e2e para leer los emails enviados.
    RESEND_API_KEY: opcional,
    CORREO_REMITENTE: opcional,
    CORREO_ARCHIVO: opcional,
  })
const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const detalle = Object.entries(parsed.error.flatten().fieldErrors)
    .map(([clave, errores]) => `  - ${clave}: ${errores?.join(", ")}`)
    .join("\n");
  throw new Error(`Variables de entorno inválidas (ver .env.example):\n${detalle}`);
}

export const env = parsed.data;
