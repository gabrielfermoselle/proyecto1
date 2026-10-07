import type { DefaultSession } from "next-auth";
import type { Rol } from "@/domain/roles";

declare module "next-auth" {
  interface User {
    id: string;
    rol: Rol;
  }
  interface Session {
    user: { id: string; rol: Rol } & DefaultSession["user"];
    /** Cuándo se inició la sesión (ms). Ver domain/sesion.ts. */
    autenticadoEn?: number;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    rol: Rol;
    autenticadoEn?: number;
  }
}
