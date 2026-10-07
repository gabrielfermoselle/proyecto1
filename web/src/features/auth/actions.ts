"use server";

import bcrypt from "bcryptjs";
import { headers } from "next/headers";
import { ActionError, createPublicAction } from "@/lib/action";
import { BCRYPT_COSTO } from "@/lib/auth";
import { consumirLimite, LIMITES } from "@/lib/limite-tasa";
import { prisma } from "@/lib/prisma";
import { registroSchema } from "./schemas";

const EMAIL_EN_USO = "Ya hay una cuenta con ese email. Probá iniciar sesión.";

/**
 * Crea el usuario con su perfil vacío. El fletero completa vehículos, zona y tarifas
 * en el onboarding; hasta entonces no aparece en el buscador.
 */
export const registrarUsuario = createPublicAction({
  schema: registroSchema,
  handler: async ({ rol, nombre, apellido, email, telefono, password }) => {
    // Contra la creación masiva de cuentas. En Vercel, x-forwarded-for lo arma la plataforma.
    const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() || "desconocida";
    await consumirLimite(LIMITES.registros(ip));
    const existente = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (existente) throw new ActionError(EMAIL_EN_USO, { email: [EMAIL_EN_USO] });

    const passwordHash = await bcrypt.hash(password, BCRYPT_COSTO);
    await prisma.user.create({
      data: {
        rol,
        nombre,
        apellido,
        email,
        telefono,
        passwordHash,
        ...(rol === "CLIENTE" ? { clienteProfile: { create: {} } } : { fleteroProfile: { create: {} } }),
      },
      select: { id: true },
    });

    return { rol };
  },
});
