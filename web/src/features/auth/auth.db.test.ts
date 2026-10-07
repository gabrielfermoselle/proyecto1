import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { error, ok } from "../../../test/db/fabrica";
import { registrarUsuario } from "./actions";
import { ERROR_DEMASIADOS_INTENTOS } from "./schemas";

// Cada test usa una IP distinta: el límite de registros es por IP y la base es compartida.
const red = vi.hoisted(() => ({ ip: "10.0.0.1" }));
vi.mock("next/headers", () => ({ headers: async () => new Headers({ "x-forwarded-for": red.ip }) }));
beforeEach(() => {
  red.ip = `10.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`;
});

const emailUnico = () => `persona-${randomUUID().slice(0, 8)}@test.local`;

const registro = (cambios: Record<string, unknown> = {}) => ({
  rol: "CLIENTE" as const,
  nombre: "Lucía",
  apellido: "Pérez",
  email: emailUnico(),
  telefono: "",
  password: "clave1234",
  confirmarPassword: "clave1234",
  ...cambios,
});

const campo = (r: { ok: boolean; fieldErrors?: Record<string, string[] | undefined> }, nombre: string) =>
  r.ok ? undefined : r.fieldErrors?.[nombre];

describe("registrarUsuario", () => {
  it("crea un cliente con su perfil y la contraseña hasheada", async () => {
    const datos = registro();
    expect(ok(await registrarUsuario(datos))).toEqual({ rol: "CLIENTE" });

    const u = await prisma.user.findUniqueOrThrow({
      where: { email: datos.email },
      include: { clienteProfile: true, fleteroProfile: true },
    });
    expect(u.clienteProfile).not.toBeNull();
    expect(u.fleteroProfile).toBeNull();
    expect(u.passwordHash).not.toContain("clave1234");
    expect(await bcrypt.compare("clave1234", u.passwordHash)).toBe(true);
  });

  it("crea un fletero con el onboarding pendiente (no aparece en búsquedas)", async () => {
    const datos = registro({ rol: "FLETERO" });
    ok(await registrarUsuario(datos));

    const u = await prisma.user.findUniqueOrThrow({
      where: { email: datos.email },
      include: { fleteroProfile: true },
    });
    expect(u.rol).toBe("FLETERO");
    expect(u.fleteroProfile?.onboardingCompletadoEn).toBeNull();
  });

  it("nadie puede registrarse como administrador", async () => {
    const r = await registrarUsuario(registro({ rol: "ADMIN" }) as never);
    expect(campo(r, "rol")).toBeDefined();
    expect(await prisma.user.count({ where: { rol: "ADMIN", nombre: "Lucía" } })).toBe(0);
  });

  it("normaliza el email y no permite duplicarlo cambiando mayúsculas o espacios", async () => {
    const email = emailUnico();
    ok(await registrarUsuario(registro({ email: `  ${email.toUpperCase()} ` })));
    expect(await prisma.user.count({ where: { email } })).toBe(1);

    const r = await registrarUsuario(registro({ email: email.replace("persona", "PERSONA") }));
    expect(campo(r, "email")).toEqual([expect.stringMatching(/Ya hay una cuenta con ese email/)]);
  });

  it("guarda el teléfono solo con dígitos", async () => {
    const datos = registro({ telefono: "(381) 411-2222" });
    ok(await registrarUsuario(datos));

    expect((await prisma.user.findUniqueOrThrow({ where: { email: datos.email } })).telefono).toBe(
      "3814112222",
    );
  });

  it.each([
    ["corta", "abc12", /al menos 8/],
    ["sin números", "solamenteletras", /al menos un número/],
    ["sin letras", "1234567890", /al menos una letra/],
    ["de más de 72 caracteres (bcrypt la truncaría)", `a1${"x".repeat(71)}`, /como máximo 72/],
  ])("rechaza una contraseña %s", async (_caso, password, mensaje) => {
    const r = await registrarUsuario(registro({ password, confirmarPassword: password }));
    expect(campo(r, "password")).toEqual(expect.arrayContaining([expect.stringMatching(mensaje)]));
  });

  it("exige que la confirmación coincida", async () => {
    const r = await registrarUsuario(registro({ confirmarPassword: "otra12345" }));
    expect(campo(r, "confirmarPassword")).toEqual(["Las contraseñas no coinciden"]);
  });

  it("frena la creación masiva: más de 5 cuentas por hora desde la misma IP", async () => {
    for (let i = 0; i < 5; i++) ok(await registrarUsuario(registro()));

    const datos = registro();
    expect(error(await registrarUsuario(datos))).toMatch(/muchas cuentas desde esta conexión/);
    expect(await prisma.user.count({ where: { email: datos.email } })).toBe(0);
  });
});

describe("login (authorize de NextAuth)", () => {
  type Credenciales = { email: string; password: string };
  const authorize = (c: Credenciales) => {
    const proveedor = authOptions.providers[0] as unknown as {
      options: { authorize: (c: Credenciales, req: unknown) => Promise<unknown> };
    };
    return proveedor.options.authorize(c, {});
  };

  async function cuenta(activo = true) {
    const email = emailUnico();
    await prisma.user.create({
      data: {
        email,
        passwordHash: await bcrypt.hash("clave1234", 4),
        nombre: "Mario",
        apellido: "Paz",
        rol: "FLETERO",
        activo,
        fleteroProfile: { create: {} },
      },
    });
    return email;
  }

  it("con las credenciales correctas devuelve el usuario con su rol", async () => {
    const email = await cuenta();
    expect(await authorize({ email, password: "clave1234" })).toMatchObject({
      email,
      rol: "FLETERO",
      name: "Mario Paz",
    });
  });

  it("acepta el email con mayúsculas y espacios", async () => {
    const email = await cuenta();
    expect(await authorize({ email: ` ${email.toUpperCase()} `, password: "clave1234" })).not.toBeNull();
  });

  it("rechaza una contraseña incorrecta, un email inexistente y una cuenta desactivada", async () => {
    const email = await cuenta();
    const desactivada = await cuenta(false);

    expect(await authorize({ email, password: "otra1234" })).toBeNull();
    expect(await authorize({ email: emailUnico(), password: "clave1234" })).toBeNull();
    expect(await authorize({ email: desactivada, password: "clave1234" })).toBeNull();
  });

  it("bloquea por fuerza bruta después de 10 intentos en 15 minutos, aunque la clave sea correcta", async () => {
    const email = await cuenta();
    for (let i = 0; i < 10; i++) await authorize({ email, password: `mala${i}1234` });

    await expect(authorize({ email, password: "clave1234" })).rejects.toThrow(ERROR_DEMASIADOS_INTENTOS);
  });
});
