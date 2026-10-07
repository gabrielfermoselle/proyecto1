"use server";

import bcrypt from "bcryptjs";
import { headers } from "next/headers";
import { ROLES } from "@/domain/roles";
import { ActionError, createAction, createPublicAction } from "@/lib/action";
import { BCRYPT_COSTO } from "@/lib/auth";
import { enviarCorreo, urlPublicaApp } from "@/lib/correo";
import { consumirLimite, LIMITES } from "@/lib/limite-tasa";
import { prisma } from "@/lib/prisma";
import { correoRecuperacion, generarToken, hashToken, VIGENCIA_TOKEN_MS } from "./recuperacion";
import { cambioContrasenaSchema, registroSchema, restablecerSchema, solicitudRecuperacionSchema } from "./schemas";

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

async function ipDelRequest(): Promise<string> {
  // En Vercel, x-forwarded-for lo arma la plataforma.
  return (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() || "desconocida";
}

/**
 * Pide un link para elegir una contraseña nueva. Responde siempre lo mismo, exista o no la
 * cuenta (no revela qué emails están registrados). Un link nuevo anula los anteriores.
 */
export const solicitarRecuperacion = createPublicAction({
  schema: solicitudRecuperacionSchema,
  handler: async ({ email }) => {
    await consumirLimite(LIMITES.recuperacionesPorIp(await ipDelRequest()), LIMITES.recuperacionesPorEmail(email));
    const usuario = await prisma.user.findUnique({
      where: { email },
      select: { id: true, nombre: true, activo: true },
    });
    if (usuario?.activo) {
      const { token, tokenHash } = generarToken();
      const ahora = new Date();
      await prisma.$transaction([
        prisma.tokenRecuperacion.updateMany({
          where: { userId: usuario.id, usadoEn: null },
          data: { usadoEn: ahora },
        }),
        prisma.tokenRecuperacion.create({
          data: { userId: usuario.id, tokenHash, expiraEn: new Date(ahora.getTime() + VIGENCIA_TOKEN_MS) },
        }),
      ]);
      await enviarCorreo(
        correoRecuperacion({ para: email, nombre: usuario.nombre, link: `${urlPublicaApp()}/recuperar/${token}` }),
      );
    }
    return null;
  },
});

const LINK_INVALIDO = "El link venció o ya se usó. Pedí uno nuevo.";

/**
 * Elige la contraseña nueva con el token del email. El token se marca usado en la misma
 * transacción (dos envíos simultáneos no pueden usarlo dos veces) y se cierran las sesiones.
 */
export const restablecerContrasena = createPublicAction({
  schema: restablecerSchema,
  handler: async ({ token, nueva }) => {
    await consumirLimite(LIMITES.restablecimientosPorIp(await ipDelRequest()));
    const passwordHash = await bcrypt.hash(nueva, BCRYPT_COSTO);
    const ahora = new Date();
    await prisma.$transaction(async (tx) => {
      const registro = await tx.tokenRecuperacion.findUnique({
        where: { tokenHash: hashToken(token) },
        select: { id: true, userId: true, user: { select: { activo: true } } },
      });
      if (!registro?.user.activo) throw new ActionError(LINK_INVALIDO);
      const { count } = await tx.tokenRecuperacion.updateMany({
        where: { id: registro.id, usadoEn: null, expiraEn: { gt: ahora } },
        data: { usadoEn: ahora },
      });
      if (count === 0) throw new ActionError(LINK_INVALIDO);
      await tx.user.update({
        where: { id: registro.userId },
        data: { passwordHash, credencialesCambiadasEn: ahora },
      });
    });
    return null;
  },
});
