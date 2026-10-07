import "server-only";
import { PrismaClient } from "@prisma/client";
import { env } from "./env";

// Una sola instancia: en desarrollo el hot reload crearía conexiones nuevas en cada cambio.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({ log: env.NODE_ENV === "development" ? ["warn", "error"] : ["error"] });

if (env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
