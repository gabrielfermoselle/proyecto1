// PGlite + PostGIS con todas las migraciones del proyecto, expuesto por TCP para que Prisma (o la
// app entera, en los e2e) se conecte como a un Postgres. Lo comparten los tests de integración y
// el servidor de e2e: los dos corren contra exactamente el mismo esquema.
import { readdirSync, readFileSync } from "node:fs";
import { createServer } from "node:net";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { postgis } from "@electric-sql/pglite-postgis";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";

async function puertoLibre(): Promise<number> {
  return new Promise((resolve, reject) => {
    const s = createServer();
    s.listen(0, "127.0.0.1", () => {
      const direccion = s.address();
      s.close(() =>
        typeof direccion === "object" && direccion
          ? resolve(direccion.port)
          : reject(new Error("sin puerto")),
      );
    });
  });
}

export async function levantarPglite(): Promise<{ url: string; cerrar: () => Promise<void> }> {
  const db = await PGlite.create({ extensions: { postgis } });
  const carpeta = join(process.cwd(), "prisma/migrations");
  for (const m of readdirSync(carpeta)
    .filter((d) => /^\d+_/.test(d))
    .sort()) {
    await db.exec(readFileSync(join(carpeta, m, "migration.sql"), "utf8"));
  }
  const puerto = await puertoLibre();
  const servidor = new PGLiteSocketServer({ db, port: puerto, host: "127.0.0.1", maxConnections: 10 });
  await servidor.start();

  // PGlite es una sola sesión: sin prepared statements compartidos (pgbouncer=true) y una conexión.
  const url = `postgresql://postgres:postgres@127.0.0.1:${puerto}/postgres?sslmode=disable&connection_limit=1&pgbouncer=true`;
  return {
    url,
    cerrar: async () => {
      await servidor.stop();
      await db.close();
    },
  };
}
