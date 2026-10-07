"use server";

import bcrypt from "bcryptjs";
import { headers } from "next/headers";
import { ROLES } from "@/domain/roles";
import { ActionError, createAction, createPublicAction } from "@/lib/action";
import { BCRYPT_COSTO } from "@/lib/auth";
import { consumirLimite, LIMITES } from "@/lib/limite-tasa";
import { prisma } from "@/lib/prisma";
import { cambioContrasenaSchema, registroSchema } from "./schemas";

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

const ACTUAL_INCORRECTA = "La contraseña actual no es correcta.";

/**
 * Cambia la contraseña de la sesión. Exige la actual (una sesión robada no alcanza) y marca el
 * cambio: todas las sesiones abiertas, incluida esta, dejan de valer (ver domain/sesion.ts).
 */
export const cambiarContrasena = createAction({
  schema: cambioContrasenaSchema,
  roles: ROLES,
  handler: async ({ actual, nueva }, { usuario }) => {
    await consumirLimite(LIMITES.cambiosContrasena(usuario.id));
    const { passwordHash } = await prisma.user.findUniqueOrThrow({
      where: { id: usuario.id },
      select: { passwordHash: true },
    });
    if (!(await bcrypt.compare(actual, passwordHash))) {
      throw new ActionError(ACTUAL_INCORRECTA, { actual: [ACTUAL_INCORRECTA] });
    }
    await prisma.user.update({
      where: { id: usuario.id },
      data: { passwordHash: await bcrypt.hash(nueva, BCRYPT_COSTO), credencialesCambiadasEn: new Date() },
    });
    return null;
  },
});
