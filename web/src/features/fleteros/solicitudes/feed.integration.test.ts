import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { postgis } from "@electric-sql/pglite-postgis";
import type { Prisma } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { consultaAccesoSolicitud, consultaConteosFeed, consultaFeed, type FilaFeed } from "./consultas-sql";

// Corre las consultas reales del feed contra Postgres + PostGIS (PGlite, en memoria) con la
// migración del proyecto aplicada. Verifica radio, compatibilidad, fechas, estados y orden.

const HOY = "2026-10-01";
const MIGRACIONES = join(process.cwd(), "prisma/migrations");

let db: PGlite;

async function consultar<T>(sql: Prisma.Sql): Promise<T[]> {
  const { rows } = await db.query<T>(sql.text, sql.values as unknown[]);
  return rows;
}

interface SolicitudFixture {
  id: string;
  lat: number;
  lng: number;
  fecha?: string;
  peso?: number;
  volumen?: number;
  sinMedidas?: number;
  estado?: string;
}

async function solicitud({
  id,
  lat,
  lng,
  fecha = "2026-10-03",
  peso = 50,
  volumen = 0.5,
  sinMedidas = 0,
  estado = "ABIERTA",
}: SolicitudFixture) {
  await db.query(
    `insert into solicitudes (id, "clienteId", "tipoFlete", titulo, "origenDireccion", "origenLat", "origenLng",
       "destinoDireccion", "destinoLat", "destinoLng", "distanciaKm", "pesoTotalKg", "volumenTotalM3",
       "itemsSinMedidas", fecha, franja, estado, "updatedAt")
     values ($1, 'c1', 'MUEBLES', $9, 'origen', $2, $3, 'destino', -26.82, -65.21, 3, $4, $5, $6, $7, 'MANANA', $8, now())`,
    [id, lat, lng, peso, volumen, sinMedidas, fecha, estado, `Solicitud ${id}`],
  );
}

async function presupuesto(id: string, solicitudId: string, fleteroId: string, vehiculoId: string) {
  await db.query(
    `insert into presupuestos (id, "solicitudId", "fleteroId", "vehiculoId", monto, "montoSugerido", "validoHasta", "updatedAt")
     values ($1, $2, $3, $4, 20000, 20000, now() + interval '1 day', now())`,
    [id, solicitudId, fleteroId, vehiculoId],
  );
}

beforeAll(async () => {
  db = await PGlite.create({ extensions: { postgis } });
  // Todas las migraciones, en orden (las carpetas empiezan con la fecha).
  for (const carpeta of readdirSync(MIGRACIONES, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort()) {
    await db.exec(readFileSync(join(MIGRACIONES, carpeta, "migration.sql"), "utf8"));
  }

  // Fletero "yo": base en Plaza Independencia, radio 10 km, camioneta de 1000 kg / 3,5 m³
  // (y un camión inactivo, que no tiene que contar). Fletero "otro" con un camión grande.
  await db.exec(`
    insert into usuarios (id, email, "passwordHash", nombre, apellido, rol, "updatedAt") values
      ('u-cli', 'c@x', 'h', 'C', 'C', 'CLIENTE', now()),
      ('u-yo', 'yo@x', 'h', 'Y', 'O', 'FLETERO', now()),
      ('u-otro', 'otro@x', 'h', 'O', 'T', 'FLETERO', now());
    insert into perfiles_cliente (id, "userId") values ('c1', 'u-cli');
    insert into perfiles_fletero (id, "userId", "baseLat", "baseLng", "radioCoberturaKm") values
      ('yo', 'u-yo', -26.8303, -65.2038, 10),
      ('otro', 'u-otro', -26.8303, -65.2038, 50);
    insert into vehiculos (id, "fleteroId", tipo, marca, modelo, patente, "capacidadKg", "volumenM3", activo) values
      ('v-yo', 'yo', 'CAMIONETA', 'Toyota', 'Hilux', 'AB123CD', 1000, 3.5, true),
      ('v-yo-inactivo', 'yo', 'CAMION', 'Ford', 'Cargo', 'AB124CD', 8000, 40, false),
      ('v-otro', 'otro', 'CAMION', 'Iveco', 'Daily', 'AB125CD', 3500, 16, true);
  `);

  await solicitud({ id: "cerca", lat: -26.8185, lng: -65.2105 }); // Barrio Norte, ~1,5 km
  await solicitud({ id: "media", lat: -26.8163, lng: -65.2851, fecha: "2026-10-02" }); // Yerba Buena, ~8 km
  await solicitud({ id: "sin-medidas", lat: -26.8405, lng: -65.2062, sinMedidas: 2 }); // Barrio Sur
  await solicitud({ id: "lejos", lat: -26.7322, lng: -65.2594 }); // Tafí Viejo, ~12 km: fuera del radio
  await solicitud({ id: "pesada", lat: -26.8185, lng: -65.2105, peso: 1500 }); // solo entra en el camión inactivo
  await solicitud({ id: "voluminosa", lat: -26.8185, lng: -65.2105, volumen: 4 });
  await solicitud({ id: "pasada", lat: -26.8185, lng: -65.2105, fecha: "2026-09-30" });
  await solicitud({ id: "adjudicada", lat: -26.8185, lng: -65.2105, estado: "ADJUDICADA" });
  await solicitud({ id: "ya-presupuestada", lat: -26.8185, lng: -65.2105 });
  await solicitud({ id: "con-competencia", lat: -26.835, lng: -65.2 });
  await presupuesto("p1", "ya-presupuestada", "yo", "v-yo");
  await presupuesto("p2", "con-competencia", "otro", "v-otro");
}, 120_000);

afterAll(async () => {
  await db?.close();
});

const feed = (parametros: Partial<Parameters<typeof consultaFeed>[0]> = {}) =>
  consultar<FilaFeed>(
    consultaFeed({ fleteroId: "yo", hoy: HOY, tab: "nuevas", orden: "distancia", limite: 50, ...parametros }),
  );

describe("feed del fletero (SQL real con PostGIS)", () => {
  it("muestra solo lo que está en el radio, entra en un vehículo activo, está abierto y es de hoy en adelante", async () => {
    const ids = (await feed()).map((f) => f.id).sort();
    expect(ids).toEqual(["cerca", "con-competencia", "media", "sin-medidas"]);
  });

  it("incluye las solicitudes con medidas incompletas (se marcan en la tarjeta)", async () => {
    const fila = (await feed()).find((f) => f.id === "sin-medidas");
    expect(fila?.itemsSinMedidas).toBe(2);
  });

  it("ordena por distancia a la base y después por fecha", async () => {
    const porDistancia = await feed();
    const distancias = porDistancia.map((f) => f.distanciaBaseKm);
    expect(distancias).toEqual([...distancias].sort((a, b) => a - b));
    expect(porDistancia.at(-1)?.id).toBe("media");
    expect(porDistancia.at(-1)?.distanciaBaseKm).toBeGreaterThan(7.5);

    const porFecha = await feed({ orden: "fecha" });
    expect(porFecha[0]?.id).toBe("media"); // es la única del 2/10
  });

  it("cuenta los presupuestos de otros fleteros", async () => {
    const fila = (await feed()).find((f) => f.id === "con-competencia");
    expect(fila?.presupuestosRecibidos).toBe(1);
    expect(fila?.miMonto).toBeNull();
  });

  it("la pestaña de presupuestadas muestra solo las mías, con mi monto", async () => {
    const filas = await feed({ tab: "presupuestadas" });
    expect(filas.map((f) => f.id)).toEqual(["ya-presupuestada"]);
    expect(filas[0]?.miMonto).toBe(20_000);
  });

  it("el feed de otro fletero se calcula con su zona y sus vehículos", async () => {
    const ids = (await feed({ fleteroId: "otro" })).map((f) => f.id);
    expect(ids).toContain("lejos"); // radio de 50 km
    expect(ids).toContain("pesada"); // su camión lleva 3500 kg
    expect(ids).toContain("ya-presupuestada"); // la presupuesté yo, no él
    expect(ids).not.toContain("con-competencia"); // esa ya la presupuestó él
  });

  it("filtra por distancia, fecha y tipo", async () => {
    const cercanas = (await feed({ filtros: { maxKm: 5 } })).map((f) => f.id);
    expect(cercanas).not.toContain("media"); // está a ~8 km
    expect(cercanas).toContain("cerca");
    const del2 = (await feed({ filtros: { desde: "2026-10-02", hasta: "2026-10-02" } })).map((f) => f.id);
    expect(del2).toEqual(["media"]);
    expect(await feed({ filtros: { tipo: "MUDANZA" } })).toEqual([]);
    expect((await feed({ filtros: { tipo: "MUEBLES" } })).length).toBe(4);
  });

  it("los conteos de las pestañas coinciden con las listas", async () => {
    const [conteos] = await consultar<{ nuevas: number; presupuestadas: number }>(
      consultaConteosFeed({ fleteroId: "yo", hoy: HOY }),
    );
    expect(conteos).toEqual({ nuevas: 4, presupuestadas: 1 });
  });
});

describe("acceso al detalle de una solicitud", () => {
  const acceso = async (solicitudId: string, fleteroId = "yo") =>
    (await consultar<{ permitido: boolean }>(consultaAccesoSolicitud(fleteroId, solicitudId, HOY)))[0]
      ?.permitido;

  it("permite ver las del feed y las que ya presupuesté", async () => {
    expect(await acceso("cerca")).toBe(true);
    expect(await acceso("ya-presupuestada")).toBe(true);
  });

  it("permite ver una que no entra en mis vehículos (el detalle explica por qué)", async () => {
    expect(await acceso("pesada")).toBe(true);
  });

  it("niega las que están fuera del radio, vencidas o adjudicadas a otro", async () => {
    expect(await acceso("lejos")).toBe(false);
    expect(await acceso("pasada")).toBe(false);
    expect(await acceso("adjudicada")).toBe(false);
  });

  it("devuelve vacío si la solicitud no existe", async () => {
    expect(await acceso("no-existe")).toBeUndefined();
  });
});
