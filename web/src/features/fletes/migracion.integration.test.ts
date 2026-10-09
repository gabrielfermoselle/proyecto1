import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { postgis } from "@electric-sql/pglite-postgis";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// La migración del inventario con SQL real: convierte las etapas viejas, pasa las marcas de
// carga/descarga a controles, crea las firmas de los fletes entregados y aplica las reglas.

const NUEVA = "20261003000000_inventario_seguimiento";
let db: PGlite;

const filas = async <T>(sql: string) => (await db.query<T>(sql)).rows;

beforeAll(async () => {
  db = await PGlite.create({ extensions: { postgis } });
  const carpeta = join(process.cwd(), "prisma/migrations");
  const migraciones = readdirSync(carpeta)
    .filter((d) => /^\d+_/.test(d))
    .sort();
  const aplicar = (m: string) => db.exec(readFileSync(join(carpeta, m, "migration.sql"), "utf8"));

  // Base con el formato anterior a la migración nueva.
  for (const m of migraciones.filter((m) => m < NUEVA)) await aplicar(m);
  await db.exec(`
    insert into usuarios (id,email,"passwordHash",nombre,apellido,rol,"updatedAt") values
      ('u-ana','a@x','h','Ana','Pereyra','CLIENTE',now()), ('u-carlos','c@x','h','Carlos','Rodríguez','FLETERO',now());
    insert into perfiles_cliente (id,"userId") values ('c-ana','u-ana');
    insert into perfiles_fletero (id,"userId") values ('f-carlos','u-carlos');
    insert into vehiculos (id,"fleteroId",tipo,marca,modelo,patente,"capacidadKg","volumenM3") values
      ('v1','f-carlos','AUTO','a','b','AB123CD',500,3);
    insert into solicitudes (id,"clienteId","tipoFlete",titulo,"origenDireccion","origenLat","origenLng","destinoDireccion","destinoLat","destinoLng","distanciaKm",fecha,franja,estado,"updatedAt") values
      ('s-cargado','c-ana','MUEBLES','Cargado','o',-26.8,-65.2,'d',-26.81,-65.21,1,'2026-10-05','MANANA','ADJUDICADA',now()),
      ('s-completo','c-ana','MUEBLES','Completo','o',-26.8,-65.2,'d',-26.81,-65.21,1,'2026-09-05','MANANA','ADJUDICADA',now());
    insert into items_inventario (id,"solicitudId",nombre,cantidad,"cargadoEn","descargadoEn") values
      ('i1','s-cargado','Heladera',1,'2026-10-05 10:00',null),
      ('i2','s-cargado','Cajas',4,'2026-10-05 10:05',null),
      ('i3','s-completo','Sillón',1,'2026-09-05 10:00','2026-09-05 11:00');
    insert into presupuestos (id,"solicitudId","fleteroId","vehiculoId",monto,"montoSugerido","validoHasta",estado,"updatedAt") values
      ('p1','s-cargado','f-carlos','v1',1000,1000,'2026-10-04','ACEPTADO',now()),
      ('p2','s-completo','f-carlos','v1',1000,1000,'2026-09-04','ACEPTADO',now());
    insert into fletes (id,"solicitudId","presupuestoId","clienteId","fleteroId","vehiculoId","precioAcordado",etapa,"recepcionConfirmadaEn","updatedAt") values
      ('fl-cargado','s-cargado','p1','c-ana','f-carlos','v1',1000,'CARGADO',null,now()),
      ('fl-completo','s-completo','p2','c-ana','f-carlos','v1',1000,'COMPLETADO','2026-09-05 12:00',now());
    insert into estados_flete (id,"fleteId",etapa,"autorId","createdAt") values
      ('e1','fl-cargado','CONFIRMADO','u-ana','2026-10-04 09:00'),
      ('e2','fl-cargado','CARGADO','u-carlos','2026-10-05 10:10'),
      ('e3','fl-completo','EN_TRANSITO','u-carlos','2026-09-05 10:30'),
      ('e4','fl-completo','ENTREGADO','u-carlos','2026-09-05 11:05'),
      ('e5','fl-completo','COMPLETADO','u-ana','2026-09-05 12:00');
  `);
  await aplicar(NUEVA);
}, 120_000);

afterAll(async () => {
  await db?.close();
});

describe(`migración ${NUEVA}`, () => {
  it("convierte las etapas viejas del flete y del historial", async () => {
    expect(await filas(`select id, etapa from fletes order by id`)).toEqual([
      { id: "fl-cargado", etapa: "CARGANDO" },
      { id: "fl-completo", etapa: "CERRADO" },
    ]);
    expect(await filas(`select id, etapa from estados_flete order by id`)).toEqual([
      { id: "e1", etapa: "CONFIRMADO" },
      { id: "e2", etapa: "CARGANDO" },
      { id: "e3", etapa: "EN_TRASLADO" },
      { id: "e4", etapa: "ENTREGADO" },
      { id: "e5", etapa: "CERRADO" },
    ]);
  });

  it("pasa las marcas de carga y descarga a controles, con su autor", async () => {
    expect(
      await filas(
        `select "itemId", "fleteId", fase, resultado, "autorId" from controles_item order by "itemId", fase`,
      ),
    ).toEqual([
      { itemId: "i1", fleteId: "fl-cargado", fase: "CARGA", resultado: "CARGADO", autorId: "u-carlos" },
      { itemId: "i2", fleteId: "fl-cargado", fase: "CARGA", resultado: "CARGADO", autorId: "u-carlos" },
      { itemId: "i3", fleteId: "fl-completo", fase: "CARGA", resultado: "CARGADO", autorId: "u-carlos" },
      { itemId: "i3", fleteId: "fl-completo", fase: "DESCARGA", resultado: "ENTREGADO", autorId: "u-carlos" },
      { itemId: "i3", fleteId: "fl-completo", fase: "RECEPCION", resultado: "CONFORME", autorId: "u-ana" },
    ]);
    // Conserva la hora original de la marca (comparada como texto: el timestamp no tiene zona).
    const [carga] = await filas<{ en: string }>(
      `select "createdAt"::text as en from controles_item where "itemId"='i1'`,
    );
    expect(carga?.en).toBe("2026-10-05 10:00:00");
  });

  it("crea las firmas de los fletes entregados y cerrados", async () => {
    expect(await filas(`select "fleteId", rol, "userId" from conformidades order by rol`)).toEqual([
      { fleteId: "fl-completo", rol: "CLIENTE", userId: "u-ana" },
      { fleteId: "fl-completo", rol: "FLETERO", userId: "u-carlos" },
    ]);
  });

  it("los ítems existentes quedan en buen estado y sin las columnas viejas", async () => {
    expect(await filas(`select distinct "estadoInicial" from items_inventario`)).toEqual([
      { estadoInicial: "BUENO" },
    ]);
    const columnas = await filas<{ column_name: string }>(
      `select column_name from information_schema.columns where table_name = 'items_inventario'`,
    );
    expect(columnas.map((c) => c.column_name)).not.toContain("cargadoEn");
  });

  it("cada fase acepta solo sus resultados", async () => {
    await expect(
      db.exec(`insert into controles_item (id,"itemId","fleteId",fase,resultado,"autorId","updatedAt")
               values ('x','i1','fl-cargado','DESCARGA','CARGADO','u-carlos',now())`),
    ).rejects.toThrow(/control_resultado_de_su_fase/);
    // Un control por ítem y fase.
    await expect(
      db.exec(`insert into controles_item (id,"itemId","fleteId",fase,resultado,"autorId","updatedAt")
               values ('y','i1','fl-cargado','CARGA','NO_CARGADO','u-carlos',now())`),
    ).rejects.toThrow(/controles_item_itemId_fase_key/);
  });

  it("una foto tiene un solo dueño, también entre controles y reclamos", async () => {
    const [control] = await filas<{ id: string }>(`select id from controles_item where "itemId"='i1'`);
    await db.exec(
      `insert into fotos (id, ruta, "controlId") values ('foto-ok', 'r/ok.jpg', '${control!.id}')`,
    );
    await expect(
      db.exec(
        `insert into fotos (id, ruta, "controlId", "itemId") values ('foto-mal', 'r/mal.jpg', '${control!.id}', 'i1')`,
      ),
    ).rejects.toThrow(/foto_un_solo_duenio/);
  });

  it("la ubicación del historial va completa y con coordenadas válidas", async () => {
    await db.exec(`insert into estados_flete (id,"fleteId",etapa,"autorId",lat,lng,"precisionM")
                   values ('ok','fl-cargado','EN_TRASLADO','u-carlos',-26.8,-65.2,15)`);
    await expect(
      db.exec(
        `insert into estados_flete (id,"fleteId",etapa,"autorId",lat) values ('mal1','fl-cargado','EN_TRASLADO','u-carlos',-26.8)`,
      ),
    ).rejects.toThrow(/estado_ubicacion_valida/);
    await expect(
      db.exec(
        `insert into estados_flete (id,"fleteId",etapa,"autorId",lat,lng) values ('mal2','fl-cargado','EN_TRASLADO','u-carlos',-126.8,-65.2)`,
      ),
    ).rejects.toThrow(/estado_ubicacion_valida/);
  });
});
