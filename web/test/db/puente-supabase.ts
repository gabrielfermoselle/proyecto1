// La app habla HTTP con Supabase. Este puente publica el Postgres de prueba en /rest/v1.
import { createServer, request as httpRequest } from "node:http";
import type { AddressInfo } from "node:net";
import { firmarJwtHs256 } from "../../src/lib/jwt";
import { notificarPostgrest } from "./sql";

export const SECRETO_JWT_PRUEBA = "secreto-de-test-jwt-con-mas-de-32-chars";

async function esperar(url: string) {
  for (let i = 0; i < 40; i++) {
    try {
      const respuesta = await fetch(url);
      if (respuesta.status < 500) return;
    } catch {
      // Todavía no acepta conexiones.
    }
    await new Promise((resolver) => setTimeout(resolver, 500));
  }
  throw new Error(`PostgREST no respondió en ${url}`);
}

function proxyHacia(destino: URL) {
  const servidor = createServer((req, res) => {
    const ruta = (req.url ?? "/").replace(/^\/rest\/v1/, "") || "/";
    const proxy = httpRequest(
      {
        hostname: destino.hostname,
        port: destino.port,
        path: ruta,
        method: req.method,
        headers: { ...req.headers, host: destino.host },
      },
      (respuesta) => {
        const headers = { ...respuesta.headers };
        delete headers["transfer-encoding"];
        delete headers.connection;
        res.writeHead(respuesta.statusCode ?? 502, headers);
        respuesta.pipe(res);
      },
    );
    proxy.on("error", () => {
      if (!res.headersSent) res.writeHead(502);
      res.end();
    });
    req.pipe(proxy);
  });
  return new Promise<{ url: string; cerrar: () => void }>((resolver) => {
    servidor.listen(0, "127.0.0.1", () => {
      const puerto = (servidor.address() as AddressInfo).port;
      resolver({ url: `http://127.0.0.1:${puerto}`, cerrar: () => servidor.close() });
    });
  });
}

/** Apunta SUPABASE_URL al Postgres de prueba, con un JWT que PostgREST acepta. */
export async function publicarSupabaseDePrueba(databaseUrl: string) {
  const postgrest = process.env.POSTGREST_URL;
  if (!postgrest) throw new Error("Falta POSTGREST_URL");
  const secreto = process.env.PGRST_JWT_SECRET || SECRETO_JWT_PRUEBA;
  await esperar(postgrest);
  await notificarPostgrest(databaseUrl);
  const puente = await proxyHacia(new URL(postgrest));
  const clave = firmarJwtHs256(
    { role: "postgres", exp: Math.floor(Date.now() / 1000) + 60 * 60 * 12 },
    secreto,
  );
  Object.assign(process.env, {
    SUPABASE_URL: puente.url,
    SUPABASE_SERVICE_ROLE_KEY: clave,
    SUPABASE_ANON_KEY: clave,
    SUPABASE_JWT_SECRET: secreto,
  });
  return puente;
}
