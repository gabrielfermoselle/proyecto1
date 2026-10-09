// Se corre antes de cada archivo *.db.test.ts: simula lo que en la app resuelve Next.
import { vi } from "vitest";
import { sesion } from "./sesion";

vi.mock("@/lib/session", () => ({
  getUsuarioActual: async () => sesion.actual,
  requireUsuario: async () => sesion.actual,
}));
vi.mock("next/cache", () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined }));
vi.mock("next/headers", () => ({ headers: async () => new Headers({ "x-forwarded-for": "10.0.0.1" }) }));
