import "server-only";
import { Prisma } from "@prisma/client";
import type { z } from "zod";
import type { Rol } from "@/domain/roles";
import { getUsuarioActual, type UsuarioActual } from "./session";
import { logDelRequest } from "./log";

import type { ActionResult, FieldErrors } from "./action-result";

export type { ActionResult, FieldErrors };

/** Error de negocio esperado: su mensaje se muestra tal cual al usuario. */
export class ActionError extends Error {
  constructor(
    message: string,
    readonly fieldErrors?: FieldErrors,
  ) {
    super(message);
    this.name = "ActionError";
  }
}

/** El error es una violación de un índice único (P2002), opcionalmente sobre un campo. */
export function esViolacionUnica(error: unknown, campo?: string): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") return false;
  if (!campo) return true;
  const target = error.meta?.target;
  return Array.isArray(target) ? target.includes(campo) : String(target ?? "").includes(campo);
}

const MENSAJE_INESPERADO = "Algo salió mal. Probá de nuevo en unos minutos.";

async function ejecutar<S extends z.ZodTypeAny, T>(
  schema: S,
  raw: unknown,
  handler: (input: z.output<S>) => Promise<T>,
): Promise<ActionResult<T>> {
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Revisá los datos marcados.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    return { ok: true, data: await handler(parsed.data) };
  } catch (error) {
    if (error instanceof ActionError) {
      return error.fieldErrors
        ? { ok: false, error: error.message, fieldErrors: error.fieldErrors }
        : { ok: false, error: error.message };
    }
    if (esViolacionUnica(error)) {
      return { ok: false, error: "Ya existe un registro con esos datos." };
    }
    (await logDelRequest()).error("action.error_inesperado", { error });
    return { ok: false, error: MENSAJE_INESPERADO };
  }
}

/**
 * Server Action autenticada: valida el input con Zod, exige sesión y rol, y traduce los
 * errores a un `ActionResult` serializable. Verificar que el recurso sea del usuario le
 * corresponde al handler, filtrando siempre con `ctx.usuario`.
 */
export function createAction<S extends z.ZodTypeAny, T>(config: {
  schema: S;
  roles: readonly Rol[];
  handler: (input: z.output<S>, ctx: { usuario: UsuarioActual }) => Promise<T>;
}) {
  return async (raw: z.input<S>): Promise<ActionResult<T>> => {
    const usuario = await getUsuarioActual();
    if (!usuario) return { ok: false, error: "Tu sesión expiró. Volvé a iniciar sesión." };
    if (!config.roles.includes(usuario.rol)) return { ok: false, error: "No tenés permiso para hacer esto." };
    return ejecutar(config.schema, raw, (input) => config.handler(input, { usuario }));
  };
}

/** Server Action sin sesión (registro, recuperación de contraseña). */
export function createPublicAction<S extends z.ZodTypeAny, T>(config: {
  schema: S;
  handler: (input: z.output<S>) => Promise<T>;
}) {
  return async (raw: z.input<S>): Promise<ActionResult<T>> => ejecutar(config.schema, raw, config.handler);
}

/** Server Action del cliente: inyecta su `clienteId`. */
export function createClienteAction<S extends z.ZodTypeAny, T>(config: {
  schema: S;
  handler: (input: z.output<S>, ctx: { usuario: UsuarioActual; clienteId: string }) => Promise<T>;
}) {
  return createAction({
    schema: config.schema,
    roles: ["CLIENTE"],
    handler: async (input, { usuario }) => {
      const perfil = usuario.clienteProfile;
      if (!perfil) throw new ActionError("No encontramos tu perfil de cliente.");
      return config.handler(input, { usuario, clienteId: perfil.id });
    },
  });
}

/**
 * Server Action del fletero: inyecta su `fleteroId`. Por defecto exige el onboarding completo;
 * las acciones del propio onboarding pasan `requiereOnboarding: false`.
 */
export function createFleteroAction<S extends z.ZodTypeAny, T>(config: {
  schema: S;
  requiereOnboarding?: boolean;
  handler: (input: z.output<S>, ctx: { usuario: UsuarioActual; fleteroId: string }) => Promise<T>;
}) {
  return createAction({
    schema: config.schema,
    roles: ["FLETERO"],
    handler: async (input, { usuario }) => {
      const perfil = usuario.fleteroProfile;
      if (!perfil) throw new ActionError("No encontramos tu perfil de fletero.");
      if (config.requiereOnboarding !== false && !perfil.onboardingCompletadoEn) {
        throw new ActionError("Terminá de configurar tu perfil para poder hacer esto.");
      }
      return config.handler(input, { usuario, fleteroId: perfil.id });
    },
  });
}
