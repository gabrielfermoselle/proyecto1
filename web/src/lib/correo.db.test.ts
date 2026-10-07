import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

// lib/env valida process.env al importarse: cada caso importa el módulo de nuevo con su entorno.
async function correoCon(variables: Record<string, string | undefined>) {
  vi.resetModules();
  for (const [clave, valor] of Object.entries(variables)) vi.stubEnv(clave, valor ?? "");
  return import("./correo");
}

const correo = { para: "ana@test.local", asunto: "Hola", texto: "link: https://x/recuperar/abc", html: "<p>hola</p>" };

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("enviarCorreo", () => {
  it("con RESEND_API_KEY llama a la API de Resend con el remitente configurado", async () => {
    const llamadas: { url: string; init: RequestInit }[] = [];
    vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
      llamadas.push({ url, init });
      return new Response("{}", { status: 200 });
    });
    const m = await correoCon({ RESEND_API_KEY: "re_test", CORREO_REMITENTE: "Fletes <no-responder@fletes.test>" });

    expect(m.correoConfigurado()).toBe(true);
    expect(await m.enviarCorreo(correo)).toBe(true);
    expect(llamadas[0]!.url).toBe("https://api.resend.com/emails");
    expect((llamadas[0]!.init.headers as Record<string, string>).Authorization).toBe("Bearer re_test");
    expect(JSON.parse(String(llamadas[0]!.init.body))).toMatchObject({
      from: "Fletes <no-responder@fletes.test>",
      to: ["ana@test.local"],
      subject: "Hola",
    });
  });

  it("si Resend rechaza, devuelve false sin tirar", async () => {
    vi.stubGlobal("fetch", async () => new Response("dominio no verificado", { status: 403 }));
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const m = await correoCon({ RESEND_API_KEY: "re_test" });
    expect(await m.enviarCorreo(correo)).toBe(false);
  });

  it("sin clave y con CORREO_ARCHIVO, agrega el email al archivo (lo usan los e2e)", async () => {
    const archivo = join(mkdtempSync(join(tmpdir(), "correos-")), "correos.jsonl");
    const m = await correoCon({ RESEND_API_KEY: undefined, CORREO_ARCHIVO: archivo });
    expect(await m.enviarCorreo(correo)).toBe(true);
    expect(JSON.parse(readFileSync(archivo, "utf8").trim())).toMatchObject({ para: "ana@test.local", asunto: "Hola" });
  });

  it("en producción sin clave no envía ni escribe el link en los logs", async () => {
    const aviso = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const m = await correoCon({ RESEND_API_KEY: undefined, CORREO_ARCHIVO: undefined, NODE_ENV: "production" });
    expect(await m.enviarCorreo(correo)).toBe(false);
    expect(JSON.stringify([...aviso.mock.calls, ...info.mock.calls])).not.toContain("recuperar/abc");
  });
});

describe("urlPublicaApp", () => {
  it("usa NEXTAUTH_URL; si no, la URL del deploy de Vercel; si no, localhost", async () => {
    expect((await correoCon({ NEXTAUTH_URL: "https://fletes.test/", VERCEL_URL: "x.vercel.app" })).urlPublicaApp()).toBe(
      "https://fletes.test",
    );
    expect((await correoCon({ NEXTAUTH_URL: undefined, VERCEL_URL: "x.vercel.app" })).urlPublicaApp()).toBe(
      "https://x.vercel.app",
    );
    expect((await correoCon({ NEXTAUTH_URL: undefined, VERCEL_URL: undefined })).urlPublicaApp()).toBe(
      "http://localhost:3000",
    );
  });
});
