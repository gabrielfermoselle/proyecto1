import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";
import { AREA_POR_ROL, esRol, puedeAcceder } from "@/domain/roles";

/**
 * Primera barrera, en el Edge: sin sesión → /login (con callbackUrl); rol equivocado → su área.
 * No reemplaza la autorización del servidor: cada layout, página y Server Action vuelve a
 * verificar sesión, rol y pertenencia del recurso contra la base.
 */
export default withAuth(
  function middleware(req) {
    const rol = req.nextauth.token?.rol;
    if (!esRol(rol)) return NextResponse.redirect(new URL("/login", req.url));
    if (!puedeAcceder(rol, req.nextUrl.pathname)) {
      return NextResponse.redirect(new URL(AREA_POR_ROL[rol], req.url));
    }
    return NextResponse.next();
  },
  {
    callbacks: { authorized: ({ token }) => token !== null },
    pages: { signIn: "/login" },
  },
);

export const config = {
  matcher: ["/cliente/:path*", "/fletero/:path*", "/admin/:path*"],
};
