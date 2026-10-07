import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { limpiarTokensRecuperacion } from "@/features/mantenimiento/servicio";
import type { Correo } from "@/lib/correo";
import { prisma } from "@/lib/prisma";
import { error, ok } from "../../../test/db/fabrica";
import { restablecerContrasena, solicitarRecuperacion } from "./actions";
import { correoRecuperacion, generarToken, hashToken } from "./recuperacion";

// Recuperar la contraseña por email: el token viaja solo en el email, en la base queda su hash,
// vence a los 30 minutos y se usa una sola vez.

const enviados = vi.hoisted(() => ({ lista: [] as Correo[] }));
vi.mock("@/lib/correo", () => ({
  enviarCorreo: async (c: Correo) => {
    enviados.lista.push(c);
    return true;
  },
  urlPublicaApp: () => "https://fletes.test",
}));
// Una IP distinta por test: los límites son por IP y la base es compartida.
const red = vi.hoisted(() => ({ ip: "10.0.0.1" }));
vi.mock("next/headers", () => ({ headers: async () => new Headers({ "x-forwarded-for": red.ip }) }));
beforeEach(() => {
  enviados.lista = [];
  red.ip = `10.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`;
});

async function cuenta(activo = true) {
  const email = `olvido-${randomUUID().slice(0, 8)}@test.local`;
  const u = await prisma.user.create({
    data: {
      email,
      passwordHash: await bcrypt.hash("vieja1234", 4),
      nombre: "Olga",
      apellido: "Paz",
      rol: "CLIENTE",
      activo,
      clienteProfile: { create: {} },
    },
    select: { id: true },
  });
  return { id: u.id, email };
}

/** El token que llegó en el último email. */
function tokenDelEmail(): string {
  const link = enviados.lista.at(-1)?.texto.match(/https:\/\/fletes\.test\/recuperar\/(\S+)/);
  if (!link?.[1]) throw new Error("No llegó el email con el link");
  return link[1];
}

const restablecer = (token: string, nueva = "nueva12345") => restablecerContrasena({ token, nueva, confirmar: nueva });

describe("tokens", () => {
  it("son de 256 bits en base64url y en la base se guarda solo el SHA-256", () => {
    const { token, tokenHash } = generarToken();
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(tokenHash).toMatch(/^[0-9a-f]{64}$/);
    expect(hashToken(token)).toBe(tokenHash);
    expect(generarToken().token).not.toBe(token);
  });

  it("el email escapa el nombre en el HTML", () => {
    const c = correoRecuperacion({ para: "a@b.c", nombre: "<script>", link: "https://x/recuperar/t" });
    expect(c.html).not.toContain("<script>");
    expect(c.texto).toContain("https://x/recuperar/t");
  });
});

describe("solicitarRecuperacion", () => {
  it("con una cuenta activa envía el link y guarda solo el hash del token", async () => {
    const c = await cuenta();
    ok(await solicitarRecuperacion({ email: c.email.toUpperCase() }));

    expect(enviados.lista).toHaveLength(1);
    expect(enviados.lista[0]!.para).toBe(c.email);
    const token = tokenDelEmail();
    const guardados = await prisma.tokenRecuperacion.findMany({ where: { userId: c.id } });
    expect(guardados).toHaveLength(1);
    expect(guardados[0]!.tokenHash).toBe(hashToken(token));
    expect(JSON.stringify(guardados)).not.toContain(token);
    expect(guardados[0]!.expiraEn.getTime() - Date.now()).toBeGreaterThan(29 * 60 * 1000);
  });

  it("responde igual si el email no existe o la cuenta está desactivada, y no envía nada", async () => {
    const desactivada = await cuenta(false);
    expect(await solicitarRecuperacion({ email: `nadie-${randomUUID()}@test.local` })).toEqual({ ok: true, data: null });
    expect(await solicitarRecuperacion({ email: desactivada.email })).toEqual({ ok: true, data: null });
    expect(enviados.lista).toHaveLength(0);
  });

  it("un link nuevo anula los anteriores", async () => {
    const c = await cuenta();
    ok(await solicitarRecuperacion({ email: c.email }));
    const primero = tokenDelEmail();
    ok(await solicitarRecuperacion({ email: c.email }));

    expect(error(await restablecer(primero))).toMatch(/venció o ya se usó/);
    ok(await restablecer(tokenDelEmail()));
  });

  it("no inunda una casilla: más de 3 pedidos por hora para el mismo email", async () => {
    const c = await cuenta();
    for (let i = 0; i < 3; i++) ok(await solicitarRecuperacion({ email: c.email }));
    expect(error(await solicitarRecuperacion({ email: c.email }))).toMatch(/varios links/);
    expect(enviados.lista).toHaveLength(3);
  });
});

describe("restablecerContrasena", () => {
  it("cambia la contraseña, marca el cambio (cierra sesiones) y el link no se puede reusar", async () => {
    const c = await cuenta();
    ok(await solicitarRecuperacion({ email: c.email }));
    const token = tokenDelEmail();

    ok(await restablecer(token));

    const u = await prisma.user.findUniqueOrThrow({ where: { id: c.id } });
    expect(await bcrypt.compare("nueva12345", u.passwordHash)).toBe(true);
    expect(u.credencialesCambiadasEn).not.toBeNull();
    expect(error(await restablecer(token, "otra98765"))).toMatch(/venció o ya se usó/);
  });

  it("rechaza un link vencido", async () => {
    const c = await cuenta();
    const { token, tokenHash } = generarToken();
    await prisma.tokenRecuperacion.create({
      data: {
        userId: c.id,
        tokenHash,
        createdAt: new Date(Date.now() - 40 * 60 * 1000),
        expiraEn: new Date(Date.now() - 10 * 60 * 1000),
      },
    });
    expect(error(await restablecer(token))).toMatch(/venció o ya se usó/);
  });

  it("rechaza un token inventado o con formato inválido", async () => {
    expect(error(await restablecer(generarToken().token))).toMatch(/venció o ya se usó/);
    const r = await restablecer("corto");
    expect(r.ok ? undefined : r.fieldErrors?.token).toEqual(["El link no es válido."]);
  });

  it("aplica la política de contraseñas", async () => {
    const r = await restablecer(generarToken().token, "solamenteletras");
    expect(r.ok ? undefined : r.fieldErrors?.nueva).toBeDefined();
  });
});

describe("mantenimiento", () => {
  it("borra los tokens vencidos o usados hace más de un día y deja los vigentes", async () => {
    const c = await cuenta();
    const dia = 24 * 60 * 60 * 1000;
    const viejo = generarToken();
    const vigente = generarToken();
    await prisma.tokenRecuperacion.createMany({
      data: [
        { userId: c.id, tokenHash: viejo.tokenHash, createdAt: new Date(Date.now() - 3 * dia), expiraEn: new Date(Date.now() - 2 * dia) },
        { userId: c.id, tokenHash: vigente.tokenHash, expiraEn: new Date(Date.now() + 30 * 60 * 1000) },
      ],
    });

    expect(await limpiarTokensRecuperacion()).toBeGreaterThanOrEqual(1);
    const quedan = await prisma.tokenRecuperacion.findMany({ where: { userId: c.id }, select: { tokenHash: true } });
    expect(quedan.map((t) => t.tokenHash)).toEqual([vigente.tokenHash]);
  });
});
