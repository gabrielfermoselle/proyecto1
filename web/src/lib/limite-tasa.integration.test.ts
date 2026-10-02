import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { postgis } from "@electric-sql/pglite-postgis";
import type { Prisma } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { consultaConsumir, consultaLimpiar, inicioVentana } from "./limite-tasa-sql";

let db: PGlite;
const consumir = async (sql: Prisma.Sql) =>
  (await db.query<{ cantidad: number }>(sql.text, sql.values as unknown[])).rows[0]?.cantidad;

beforeAll(async () => {
  db = await PGlite.create({ extensions: { postgis } });
  const carpeta = join(process.cwd(), "prisma/migrations");
  for (const migracion of readdirSync(carpeta)
    .filter((d) => /^\d+_/.test(d))
    .sort()) {
    await db.exec(readFileSync(join(carpeta, migracion, "migration.sql"), "utf8"));
  }
}, 120_000);

afterAll(async () => {
  await db?.close();
});

describe("limitador de envíos (SQL real)", () => {
  it("alinea las ventanas a múltiplos del período", () => {
    expect(inicioVentana(new Date("2026-10-01T15:00:59.900Z"), 60).toISOString()).toBe(
      "2026-10-01T15:00:00.000Z",
    );
    expect(inicioVentana(new Date("2026-10-01T15:07:00Z"), 600).toISOString()).toBe(
      "2026-10-01T15:00:00.000Z",
    );
  });

  it("cuenta cada intento sin perder ninguno, aunque lleguen juntos", async () => {
    const ventana = new Date("2026-10-01T15:00:00Z");
    const resultados = await Promise.all(
      Array.from({ length: 25 }, () => consumir(consultaConsumir("k:a", ventana))),
    );
    expect([...resultados].sort((a, b) => (a ?? 0) - (b ?? 0))).toEqual(
      Array.from({ length: 25 }, (_, i) => i + 1),
    );
  });

  it("cada clave y cada ventana cuentan por separado", async () => {
    const ventana = new Date("2026-10-01T16:00:00Z");
    expect(await consumir(consultaConsumir("k:b", ventana))).toBe(1);
    expect(await consumir(consultaConsumir("k:c", ventana))).toBe(1);
    expect(await consumir(consultaConsumir("k:b", new Date("2026-10-01T16:01:00Z")))).toBe(1);
    expect(await consumir(consultaConsumir("k:b", ventana))).toBe(2);
  });

  it("limpia las ventanas viejas", async () => {
    const sql = consultaLimpiar(new Date("2026-10-01T15:30:00Z"));
    await db.query(sql.text, sql.values as unknown[]);
    const { rows } = await db.query<{ clave: string }>(
      "select distinct clave from limites_tasa order by clave",
    );
    expect(rows.map((r) => r.clave)).toEqual(["k:b", "k:c"]);
  });
});
