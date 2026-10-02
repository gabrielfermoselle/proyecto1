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
    DATABASE_URL: z.string().url(),
    DIRECT_URL: z.string().url(),
    NEXTAUTH_SECRET: z.string().min(32, "NEXTAUTH_SECRET debe tener al menos 32 caracteres"),
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    // Supabase (Realtime + Storage) es opcional: sin estas variables el chat funciona por
    // consultas periódicas (sin "escribiendo…" ni "en línea") y la carga de fotos se deshabilita.
    SUPABASE_URL: opcional.pipe(z.string().url().optional()),
    SUPABASE_ANON_KEY: opcional,
    SUPABASE_SERVICE_ROLE_KEY: opcional,
    SUPABASE_JWT_SECRET: opcional,
  })
  .refine(
    (e) => {
      const definidas = [
        e.SUPABASE_URL,
        e.SUPABASE_ANON_KEY,
        e.SUPABASE_SERVICE_ROLE_KEY,
        e.SUPABASE_JWT_SECRET,
      ];
      const cantidad = definidas.filter(Boolean).length;
      return cantidad === 0 || cantidad === definidas.length;
    },
    { message: "Definí las cuatro variables SUPABASE_* o ninguna", path: ["SUPABASE_URL"] },
  );

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const detalle = Object.entries(parsed.error.flatten().fieldErrors)
    .map(([clave, errores]) => `  - ${clave}: ${errores?.join(", ")}`)
    .join("\n");
  throw new Error(`Variables de entorno inválidas (ver .env.example):\n${detalle}`);
}

export const env = parsed.data;
