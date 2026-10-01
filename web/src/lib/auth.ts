import "server-only";
import bcrypt from "bcryptjs";
import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { loginSchema } from "@/features/auth/schemas";
import { env } from "./env";
import { prisma } from "./prisma";

/** Costo de bcrypt: ~250 ms por hash, suficiente contra fuerza bruta sin castigar el login. */
export const BCRYPT_COSTO = 12;

/**
 * Hash de una contraseña que nadie conoce. Si el email no existe se compara igual contra
 * este hash, así el tiempo de respuesta no revela qué emails están registrados.
 */
const HASH_SIMULADO = "$2b$12$HxdoX2erxIzZiaB2z.Enz.TDoLC48AgLDin9NQ2MscPXW3Y3E17ku";

export const authOptions: NextAuthOptions = {
  secret: env.NEXTAUTH_SECRET,
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 7 },
  pages: { signIn: "/login" },
  providers: [
    CredentialsProvider({
      name: "Email y contraseña",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Contraseña", type: "password" },
      },
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const user = await prisma.user.findUnique({
          where: { email: parsed.data.email },
          select: {
            id: true,
            email: true,
            nombre: true,
            apellido: true,
            rol: true,
            activo: true,
            passwordHash: true,
          },
        });
        const passwordOk = await bcrypt.compare(parsed.data.password, user?.passwordHash ?? HASH_SIMULADO);
        if (!user || !passwordOk || !user.activo) return null;

        return { id: user.id, email: user.email, name: `${user.nombre} ${user.apellido}`, rol: user.rol };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.rol = user.rol;
      }
      return token;
    },
    session({ session, token }) {
      session.user.id = token.id;
      session.user.rol = token.rol;
      return session;
    },
  },
};
