"use server";

import bcrypt from "bcryptjs";
import { headers } from "next/headers";
import { ROLES } from "@/domain/roles";
import { ActionError, createAction, createPublicAction, esViolacionUnica } from "@/lib/action";
import { BCRYPT_COSTO } from "@/lib/auth";
import { enviarCorreo, urlPublicaApp } from "@/lib/correo";
import { ahoraIso, db, fallar, nuevoId } from "@/lib/db";
import { consumirLimite, LIMITES } from "@/lib/limite-tasa";
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
    const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() || "desconocida";
    await consumirLimite(LIMITES.registros(ip));
    const { data: existente, error: errorBusqueda } = await db()
      .from("usuarios")
      .select("id")
      .eq("email", email)
      .maybeSingle();
    fallar(errorBusqueda);
    if (existente) throw new ActionError(EMAIL_EN_USO, { email: [EMAIL_EN_USO] });

    const userId = nuevoId();
    const passwordHash = await bcrypt.hash(password, BCRYPT_COSTO);
    const { error } = await db().from("usuarios").insert({
      id: userId,
      rol,
      nombre,
      apellido,
      email,
      telefono,
      passwordHash,
      updatedAt: ahoraIso(),
    });
    if (esViolacionUnica(error, "email")) throw new ActionError(EMAIL_EN_USO, { email: [EMAIL_EN_USO] });
    fallar(error);

    const tabla = rol === "CLIENTE" ? "perfiles_cliente" : "perfiles_fletero";
    const { error: errorPerfil } = await db().from(tabla).insert({ id: nuevoId(), userId });
    if (errorPerfil) {
      await db().from("usuarios").delete().eq("id", userId);
      fallar(errorPerfil);
    }

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
    const { data, error } = await db().from("usuarios").select("passwordHash").eq("id", usuario.id).maybeSingle();
    fallar(error);
    if (!data || !(await bcrypt.compare(actual, data.passwordHash as string))) {
      throw new ActionError(ACTUAL_INCORRECTA, { actual: [ACTUAL_INCORRECTA] });
    }
    const { error: errorUpdate } = await db()
      .from("usuarios")
      .update({ passwordHash: await bcrypt.hash(nueva, BCRYPT_COSTO), credencialesCambiadasEn: ahoraIso(), updatedAt: ahoraIso() })
      .eq("id", usuario.id);
    fallar(errorUpdate);
    return null;
  },
});

async function ipDelRequest(): Promise<string> {
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
    const { data: usuario, error } = await db()
      .from("usuarios")
      .select("id, nombre, activo")
      .eq("email", email)
      .maybeSingle();
    fallar(error);
    if (usuario?.activo) {
      const { token, tokenHash } = generarToken();
      const ahora = ahoraIso();
      const { error: errorAnular } = await db()
        .from("tokens_recuperacion")
        .update({ usadoEn: ahora })
        .eq("userId", usuario.id)
        .is("usadoEn", null);
      fallar(errorAnular);
      const { error: errorToken } = await db().from("tokens_recuperacion").insert({
        id: nuevoId(),
        userId: usuario.id,
        tokenHash,
        expiraEn: new Date(Date.now() + VIGENCIA_TOKEN_MS).toISOString(),
      });
      fallar(errorToken);
      await enviarCorreo(
        correoRecuperacion({ para: email, nombre: usuario.nombre as string, link: `${urlPublicaApp()}/recuperar/${token}` }),
      );
    }
    return null;
  },
});

const LINK_INVALIDO = "El link venció o ya se usó. Pedí uno nuevo.";

/**
 * Elige la contraseña nueva con el token del email. El token se marca usado solo si sigue
 * vigente, y se cierran las sesiones.
 */
export const restablecerContrasena = createPublicAction({
  schema: restablecerSchema,
  handler: async ({ token, nueva }) => {
    await consumirLimite(LIMITES.restablecimientosPorIp(await ipDelRequest()));
    const passwordHash = await bcrypt.hash(nueva, BCRYPT_COSTO);
    const ahora = new Date();
    const { data: registro, error } = await db()
      .from("tokens_recuperacion")
      .select("id, userId, usuarios(activo)")
      .eq("tokenHash", hashToken(token))
      .maybeSingle();
    fallar(error);
    const dueno = registro ? (Array.isArray(registro.usuarios) ? registro.usuarios[0] : registro.usuarios) : null;
    if (!registro || !dueno || !(dueno as { activo: boolean }).activo) throw new ActionError(LINK_INVALIDO);

    const { data: marcado, error: errorMarca } = await db()
      .from("tokens_recuperacion")
      .update({ usadoEn: ahora.toISOString() })
      .eq("id", registro.id)
      .is("usadoEn", null)
      .gt("expiraEn", ahora.toISOString())
      .select("id");
    fallar(errorMarca);
    if (!marcado?.length) throw new ActionError(LINK_INVALIDO);

    const { error: errorClave } = await db()
      .from("usuarios")
      .update({ passwordHash, credencialesCambiadasEn: ahora.toISOString(), updatedAt: ahora.toISOString() })
      .eq("id", registro.userId);
    fallar(errorClave);
    return null;
  },
});
