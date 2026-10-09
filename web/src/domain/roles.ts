// Roles y áreas de la app. Es puro para poder usarlo en el middleware (Edge), donde
// no se puede importar el cliente de Prisma. `lib/auth` verifica que coincida con el enum.

export const ROLES = ["CLIENTE", "FLETERO", "ADMIN"] as const;
export type Rol = (typeof ROLES)[number];

/** El rol ADMIN no se puede elegir al registrarse. */
export const ROLES_REGISTRABLES = ["CLIENTE", "FLETERO"] as const satisfies readonly Rol[];
export type RolRegistrable = (typeof ROLES_REGISTRABLES)[number];

export const AREA_POR_ROL = {
  CLIENTE: "/cliente",
  FLETERO: "/fletero",
  ADMIN: "/admin",
} as const satisfies Record<Rol, string>;

/**
 * Secciones privadas que comparten los roles (chat, notificaciones y cuenta): piden sesión,
 * pero no pertenecen a un área. Cada página decide qué ve cada rol.
 */
export const RUTAS_COMUNES = ["/chat", "/notificaciones", "/perfil"] as const;

/** Roles que entran a cada sección común (el admin no tiene chat). */
const ROLES_DE_RUTA_COMUN: Record<(typeof RUTAS_COMUNES)[number], readonly Rol[]> = {
  "/chat": ["CLIENTE", "FLETERO"],
  "/notificaciones": ["CLIENTE", "FLETERO", "ADMIN"],
  "/perfil": ["CLIENTE", "FLETERO", "ADMIN"],
};

export function esRol(valor: unknown): valor is Rol {
  return typeof valor === "string" && (ROLES as readonly string[]).includes(valor);
}

const perteneceA = (pathname: string, prefijo: string) =>
  pathname === prefijo || pathname.startsWith(`${prefijo}/`);

/** Rol dueño de la ruta, o `null` si la ruta no pertenece a ningún área privada. */
export function rolDeRuta(pathname: string): Rol | null {
  return ROLES.find((rol) => perteneceA(pathname, AREA_POR_ROL[rol])) ?? null;
}

/** Sección común a la que pertenece la ruta, o `null`. */
export function rutaComun(pathname: string): (typeof RUTAS_COMUNES)[number] | null {
  return RUTAS_COMUNES.find((r) => perteneceA(pathname, r)) ?? null;
}

/** Necesita sesión: un área de rol o una sección común. */
export const esRutaPrivada = (pathname: string) =>
  rolDeRuta(pathname) !== null || rutaComun(pathname) !== null;

/** Cada rol entra solo a su área y a las secciones comunes que le tocan. Lo demás es libre. */
export function puedeAcceder(rol: Rol, pathname: string): boolean {
  const comun = rutaComun(pathname);
  if (comun) return ROLES_DE_RUTA_COMUN[comun].includes(rol);
  const duenio = rolDeRuta(pathname);
  return duenio === null || duenio === rol;
}

/** Evita open redirects: solo se aceptan rutas internas y privadas a las que el rol puede entrar. */
export function destinoSeguro(rol: Rol, callbackUrl: string | null | undefined): string {
  const esInterna =
    typeof callbackUrl === "string" && callbackUrl.startsWith("/") && !callbackUrl.startsWith("//");
  return esInterna && esRutaPrivada(callbackUrl) && puedeAcceder(rol, callbackUrl)
    ? callbackUrl
    : AREA_POR_ROL[rol];
}
