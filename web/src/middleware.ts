import { withAuth, type NextRequestWithAuth } from "next-auth/middleware";
import { NextRequest, NextResponse, type NextFetchEvent } from "next/server";
import { AREA_POR_ROL, esRol, esRutaPrivada, puedeAcceder } from "@/domain/roles";
import { HEADER_REQUEST_ID, resolverRequestId } from "@/lib/request-id";

/**
 * Corre en el Edge para todas las rutas:
 *  1. Asigna un id a cada request (x-request-id): llega al servidor, que lo pone en sus logs, y
 *     vuelve en la respuesta para poder reportarlo.
 *  2. Primera barrera de las áreas privadas y las secciones comunes (chat, notificaciones, perfil): sin sesión → /login (con callbackUrl); rol
 *     equivocado → su área. No reemplaza la autorización del servidor: cada layout, página y
 *     Server Action vuelve a verificar sesión, rol y pertenencia del recurso contra la base.
 */

/** Sigue al servidor con los headers del request (incluido el id). */
const seguir = (req: NextRequest) => NextResponse.next({ request: { headers: new Headers(req.headers) } });

const areasPrivadas = withAuth(
  function middleware(req) {
    const rol = req.nextauth.token?.rol;
    if (!esRol(rol)) return NextResponse.redirect(new URL("/login", req.url));
    if (!puedeAcceder(rol, req.nextUrl.pathname)) {
      return NextResponse.redirect(new URL(AREA_POR_ROL[rol], req.url));
    }
    return seguir(req);
  },
  {
    callbacks: { authorized: ({ token }) => token !== null },
    pages: { signIn: "/login" },
  },
);

export default async function middleware(req: NextRequest, evento: NextFetchEvent) {
  const requestId = resolverRequestId(req.headers.get(HEADER_REQUEST_ID));
  const headers = new Headers(req.headers);
  headers.set(HEADER_REQUEST_ID, requestId);
  const conId = new NextRequest(req, { headers });

  const respuesta = !esRutaPrivada(req.nextUrl.pathname)
    ? seguir(conId)
    : ((await areasPrivadas(conId as NextRequestWithAuth, evento)) ?? seguir(conId));
  respuesta.headers.set(HEADER_REQUEST_ID, requestId);
  return respuesta;
}

export const config = {
  // Todo menos los archivos estáticos de Next y las imágenes públicas.
  matcher: ["/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:png|jpg|jpeg|svg|webp|ico)$).*)"],
};
