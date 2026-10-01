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
    // Cloudinary es opcional: sin estas variables la carga de fotos queda deshabilitada.
    CLOUDINARY_CLOUD_NAME: opcional,
    CLOUDINARY_API_KEY: opcional,
    CLOUDINARY_API_SECRET: opcional,
  })
  .refine(
    (e) => {
      const definidas = [e.CLOUDINARY_CLOUD_NAME, e.CLOUDINARY_API_KEY, e.CLOUDINARY_API_SECRET].filter(
        Boolean,
      );
      return definidas.length === 0 || definidas.length === 3;
    },
    { message: "Definí las tres variables CLOUDINARY_* o ninguna", path: ["CLOUDINARY_CLOUD_NAME"] },
  );

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const detalle = Object.entries(parsed.error.flatten().fieldErrors)
    .map(([clave, errores]) => `  - ${clave}: ${errores?.join(", ")}`)
    .join("\n");
  throw new Error(`Variables de entorno inválidas (ver .env.example):\n${detalle}`);
}

export const env = parsed.data;
