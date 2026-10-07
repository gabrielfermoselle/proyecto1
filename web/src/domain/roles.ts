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

export function esRol(valor: unknown): valor is Rol {
  return typeof valor === "string" && (ROLES as readonly string[]).includes(valor);
}

const perteneceA = (pathname: string, prefijo: string) =>
  pathname === prefijo || pathname.startsWith(`${prefijo}/`);

/** Rol dueño de la ruta, o `null` si la ruta no pertenece a ningún área privada. */
export function rolDeRuta(pathname: string): Rol | null {
  return ROLES.find((rol) => perteneceA(pathname, AREA_POR_ROL[rol])) ?? null;
}

/** Cada rol entra solo a su área. Las rutas que no son de ningún área son libres. */
export function puedeAcceder(rol: Rol, pathname: string): boolean {
  const duenio = rolDeRuta(pathname);
  return duenio === null || duenio === rol;
}

/** Evita open redirects: solo se aceptan rutas internas a las que el rol puede entrar. */
export function destinoSeguro(rol: Rol, callbackUrl: string | null | undefined): string {
  const esInterna =
    typeof callbackUrl === "string" && callbackUrl.startsWith("/") && !callbackUrl.startsWith("//");
  return esInterna && rolDeRuta(callbackUrl) === rol ? callbackUrl : AREA_POR_ROL[rol];
}
