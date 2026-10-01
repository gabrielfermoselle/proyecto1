import "server-only";
import { z } from "zod";

// Falla al arrancar, con un mensaje claro, si falta una variable de entorno.
const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  DIRECT_URL: z.string().url(),
  NEXTAUTH_SECRET: z.string().min(32, "NEXTAUTH_SECRET debe tener al menos 32 caracteres"),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const detalle = Object.entries(parsed.error.flatten().fieldErrors)
    .map(([clave, errores]) => `  - ${clave}: ${errores?.join(", ")}`)
    .join("\n");
  throw new Error(`Variables de entorno inválidas (ver .env.example):\n${detalle}`);
}

export const env = parsed.data;
