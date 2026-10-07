// Se corre antes de cada archivo *.db.test.ts: simula lo que en la app resuelve Next.
import { afterAll, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { sesion } from "./sesion";

vi.mock("@/lib/session", () => ({
  getUsuarioActual: async () => sesion.actual,
  requireUsuario: async () => sesion.actual,
}));
vi.mock("next/cache", () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined }));
vi.mock("next/headers", () => ({ headers: async () => new Headers({ "x-forwarded-for": "10.0.0.1" }) }));

// Cada archivo corre en su propio worker con su propio cliente de Prisma. Sin cerrarlo, las
// conexiones se acumulan y el servidor de PGlite (maxConnections) deja de aceptar nuevas.
afterAll(async () => {
  await prisma.$disconnect();
});
