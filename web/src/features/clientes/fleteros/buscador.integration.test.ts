import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { postgis } from "@electric-sql/pglite-postgis";
import type { Prisma } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { FACTOR_RUTA_URBANA, haversineKm } from "@/domain/geo";
import { precioSugerido } from "@/domain/precio";
import { consultaBuscador, type FilaBuscador, type ParametrosBuscador } from "./consultas-sql";

// Corre la consulta real del buscador contra Postgres + PostGIS (PGlite, en memoria) con la
// migración del proyecto: cercanía, zona de cobertura, filtros, compatibilidad y orden.

const MIGRACION = join(process.cwd(), "prisma/migrations/20261001000000_init/migration.sql");
const PLAZA = { lat: -26.8303, lng: -65.2038 }; // Plaza Independencia

let db: PGlite;

async function buscar(p: Partial<ParametrosBuscador> = {}): Promise<FilaBuscador[]> {
  const sql: Prisma.Sql = consultaBuscador({
    punto: PLAZA,
    radio: null,
    tipoVehiculo: null,
    soloDisponibles: true,
    precioMaximo: null,
    ratingMinimo: null,
    carga: null,
    orden: "distancia",
    factorRuta: FACTOR_RUTA_URBANA,
    limite: 50,
    ...p,
  });
  const { rows } = await db.query<FilaBuscador>(sql.text, sql.values as unknown[]);
  return rows;
}
const ids = (filas: FilaBuscador[]) => filas.map((f) => f.id);

interface FleteroFixture {
  id: string;
  lat: number | null;
  lng: number | null;
  radio: number;
  minimo: number;
  porKm: number;
  porM3: number;
  rating?: number;
  calificaciones?: number;
  disponible?: boolean;
  onboarding?: boolean;
  activo?: boolean;
  vehiculo: { tipo: string; kg: number; m3: number; activo?: boolean };
}

async function fletero(f: FleteroFixture) {
  await db.query(
    `insert into users (id, email, "passwordHash", nombre, apellido, rol, activo, "updatedAt")
     values ($1, $2, 'h', 'N', 'A', 'FLETERO', $3, now())`,
    [`u-${f.id}`, `${f.id}@x`, f.activo ?? true],
  );
  await db.query(
    `insert into fletero_profiles (id, "userId", "baseLat", "baseLng", "radioCoberturaKm", "precioMinimo",
       "precioPorKm", "precioPorM3", "ratingPromedio", "cantidadCalificaciones", disponible, "onboardingCompletadoEn")
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
    [
      f.id,
      `u-${f.id}`,
      f.lat,
      f.lng,
      f.radio,
      f.minimo,
      f.porKm,
      f.porM3,
      f.rating ?? 0,
      f.calificaciones ?? 0,
      f.disponible ?? true,
      f.onboarding === false ? null : new Date().toISOString(),
    ],
  );
  await db.query(
    `insert into vehiculos (id, "fleteroId", tipo, marca, modelo, patente, "capacidadKg", "volumenM3", activo)
     values ($1, $2, $3, 'M', 'X', $4, $5, $6, $7)`,
    [`v-${f.id}`, f.id, f.vehiculo.tipo, `P${f.id}`.slice(0, 10), f.vehiculo.kg, f.vehiculo.m3, f.vehiculo.activo ?? true],
  );
}

beforeAll(async () => {
  db = await PGlite.create({ extensions: { postgis } });
  await db.exec(readFileSync(MIGRACION, "utf8"));

  const camioneta = { tipo: "CAMIONETA", kg: 1000, m3: 4 };
  // Barrio Norte (~1,5 km), radio 10: llega a la plaza. Barato por km, caro de mínimo.
  await fletero({ id: "norte", lat: -26.8185, lng: -65.2105, radio: 10, minimo: 20_000, porKm: 500, porM3: 1000, rating: 4.8, calificaciones: 20, vehiculo: camioneta });
  // Yerba Buena (~8 km), radio 5: NO llega a la plaza. Mínimo barato.
  await fletero({ id: "yb", lat: -26.8163, lng: -65.2851, radio: 5, minimo: 8_000, porKm: 1500, porM3: 3000, rating: 4.2, calificaciones: 5, vehiculo: { tipo: "MOTO", kg: 30, m3: 0.1 } });
  // Tafí Viejo (~12 km), radio 40: llega. Camión grande.
  await fletero({ id: "tafi", lat: -26.7322, lng: -65.2594, radio: 40, minimo: 30_000, porKm: 2000, porM3: 500, rating: 3.5, calificaciones: 2, vehiculo: { tipo: "CAMION", kg: 8000, m3: 30 } });
  // Casos que nunca deben aparecer (o solo con el filtro correspondiente):
  await fletero({ id: "pausa", lat: -26.83, lng: -65.2, radio: 20, minimo: 10_000, porKm: 800, porM3: 800, disponible: false, vehiculo: camioneta });
  await fletero({ id: "sin-onboarding", lat: -26.83, lng: -65.2, radio: 20, minimo: 1, porKm: 1, porM3: 1, onboarding: false, vehiculo: camioneta });
  await fletero({ id: "desactivado", lat: -26.83, lng: -65.2, radio: 20, minimo: 1, porKm: 1, porM3: 1, activo: false, vehiculo: camioneta });
  await fletero({ id: "sin-vehiculo", lat: -26.83, lng: -65.2, radio: 20, minimo: 1, porKm: 1, porM3: 1, vehiculo: { ...camioneta, activo: false } });
  await fletero({ id: "sin-base", lat: null, lng: null, radio: 20, minimo: 15_000, porKm: 900, porM3: 900, rating: 5, calificaciones: 1, vehiculo: camioneta });
}, 120_000);

afterAll(async () => {
  await db?.close();
});

describe("buscador de fleteros (SQL real con PostGIS)", () => {
  it("excluye a los que no completaron el onboarding, están desactivados o no tienen vehículo activo", async () => {
    const todos = ids(await buscar({ punto: null }));
    expect(todos).not.toContain("sin-onboarding");
    expect(todos).not.toContain("desactivado");
    expect(todos).not.toContain("sin-vehiculo");
    expect(todos).not.toContain("pausa");
    expect(ids(await buscar({ punto: null, soloDisponibles: false }))).toContain("pausa");
  });

  it("con un punto, calcula la distancia y ordena del más cercano al más lejano", async () => {
    const filas = await buscar();
    expect(ids(filas)).toEqual(["norte", "yb", "tafi"]); // sin base no se puede medir: queda afuera
    const norte = filas[0]!;
    expect(norte.distanciaKm).toBeCloseTo(haversineKm(PLAZA, { lat: -26.8185, lng: -65.2105 }), 1);
    const distancias = filas.map((f) => f.distanciaKm!);
    expect(distancias).toEqual([...distancias].sort((a, b) => a - b));
  });

  it("radio 'zona': solo los fleteros cuyo radio de cobertura llega al punto", async () => {
    expect(ids(await buscar({ radio: "zona" }))).toEqual(["norte", "tafi"]);
  });

  it("radio en km: solo los que tienen la base a esa distancia o menos", async () => {
    expect(ids(await buscar({ radio: 10 }))).toEqual(["norte", "yb"]);
    expect(ids(await buscar({ radio: 1 }))).toEqual([]);
  });

  it("sin punto no hay distancia y se incluyen los que no cargaron su base", async () => {
    const filas = await buscar({ punto: null, orden: "calificacion" });
    expect(filas.every((f) => f.distanciaKm === null)).toBe(true);
    expect(ids(filas)[0]).toBe("sin-base"); // rating 5
  });

  it("filtra por tipo de vehículo, precio mínimo tope y calificación mínima", async () => {
    expect(ids(await buscar({ tipoVehiculo: "CAMION" }))).toEqual(["tafi"]);
    expect(ids(await buscar({ precioMaximo: 20_000 }))).toEqual(["norte", "yb"]);
    expect(ids(await buscar({ ratingMinimo: 4 }))).toEqual(["norte", "yb"]);
    expect(ids(await buscar({ ratingMinimo: 4.5 }))).toEqual(["norte"]);
  });

  it("sin calificaciones no pasa un filtro de calificación", async () => {
    await db.query(`update fletero_profiles set "ratingPromedio" = 0, "cantidadCalificaciones" = 0 where id = 'yb'`);
    expect(ids(await buscar({ ratingMinimo: 3 }))).toEqual(["norte", "tafi"]);
    await db.query(`update fletero_profiles set "ratingPromedio" = 4.2, "cantidadCalificaciones" = 5 where id = 'yb'`);
  });

  it("ordena por precio mínimo sin solicitud de referencia", async () => {
    expect(ids(await buscar({ orden: "precio" }))).toEqual(["yb", "norte", "tafi"]);
  });

  describe("con una solicitud de referencia", () => {
    const carga = { distanciaKm: 20, pesoTotalKg: 200, volumenTotalM3: 2, ayudantes: 1 };

    it("solo muestra a los que tienen un vehículo donde entra la carga", async () => {
      // La moto de "yb" lleva 30 kg: queda afuera.
      expect(ids(await buscar({ carga }))).toEqual(["norte", "tafi"]);
    });

    it("ordena por precio estimado, igual que el dominio", async () => {
      const filas = await buscar({ carga, orden: "precio" });
      const estimados = filas.map((f) =>
        precioSugerido(
          { distanciaLinealKm: carga.distanciaKm, volumenM3: carga.volumenTotalM3, ayudantes: carga.ayudantes },
          { precioMinimo: f.precioMinimo, precioPorKm: f.precioPorKm, precioPorM3: f.precioPorM3, precioPorAyudante: f.precioPorAyudante },
        ),
      );
      expect(estimados).toEqual([...estimados].sort((a, b) => a - b));
      // "norte" tiene el mínimo más caro pero el km más barato: en 20 km sale más barato que "tafi".
      expect(ids(filas)).toEqual(["norte", "tafi"]);
    });
  });
});
