import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { postgis } from "@electric-sql/pglite-postgis";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { consultaBandeja, consultaTotalNoLeidos, type ConsultaSql, type FilaBandeja } from "./consultas-sql";

// Bandeja con SQL real: no leídos contra la marca de lectura de cada lado, último mensaje,
// orden por actividad, flete del par y aislamiento entre participantes.

let db: PGlite;
const consultar = async <T>(sql: ConsultaSql) => (await db.query<T>(sql.sql, sql.params)).rows;

beforeAll(async () => {
  db = await PGlite.create({ extensions: { postgis } });
  const carpeta = join(process.cwd(), "prisma/migrations");
  for (const m of readdirSync(carpeta)
    .filter((d) => /^\d+_/.test(d))
    .sort()) {
    await db.exec(readFileSync(join(carpeta, m, "migration.sql"), "utf8"));
  }
  await db.exec(`
    insert into usuarios (id,email,"passwordHash",nombre,apellido,rol,"updatedAt") values
      ('u-ana','a@x','h','Ana','Pereyra','CLIENTE',now()), ('u-luis','l@x','h','Luis','Gómez','CLIENTE',now()),
      ('u-carlos','c@x','h','Carlos','Rodríguez','FLETERO',now()), ('u-sole','s@x','h','Soledad','Castro','FLETERO',now());
    insert into perfiles_cliente (id,"userId") values ('c-ana','u-ana'), ('c-luis','u-luis');
    insert into perfiles_fletero (id,"userId") values ('f-carlos','u-carlos'), ('f-sole','u-sole');
    insert into vehiculos (id,"fleteroId",tipo,marca,modelo,patente,"capacidadKg","volumenM3") values
      ('v1','f-carlos','AUTO','a','b','AB123CD',500,3), ('v2','f-sole','AUTO','a','b','AB124CD',500,3);
    insert into solicitudes (id,"clienteId","tipoFlete",titulo,"origenDireccion","origenLat","origenLng","destinoDireccion","destinoLat","destinoLng","distanciaKm",fecha,franja,estado,"updatedAt") values
      ('s1','c-ana','MUEBLES','Heladera','o',-26.8,-65.2,'d',-26.81,-65.21,1,'2026-10-05','MANANA','ADJUDICADA',now()),
      ('s2','c-luis','MUEBLES','Sillón','o',-26.8,-65.2,'d',-26.81,-65.21,1,'2026-10-06','TARDE','ABIERTA',now());
    insert into presupuestos (id,"solicitudId","fleteroId","vehiculoId",monto,"montoSugerido","validoHasta",estado,"updatedAt") values
      ('p1','s1','f-carlos','v1',1000,1000,'2026-10-04','ACEPTADO',now()),
      ('p2','s1','f-sole','v2',1200,1200,'2026-10-04','RECHAZADO',now()),
      ('p3','s2','f-carlos','v1',900,900,'2026-10-05','PENDIENTE',now());
    insert into fletes (id,"solicitudId","presupuestoId","clienteId","fleteroId","vehiculoId","precioAcordado",etapa,"updatedAt") values
      ('fl1','s1','p1','c-ana','f-carlos','v1',1000,'CARGANDO',now());
    insert into conversaciones (id,"solicitudId","fleteroId","clienteId","ultimaActividadEn","leidoHastaCliente","leidoHastaFletero") values
      ('k-ana-carlos','s1','f-carlos','c-ana','2026-10-01 12:00','2026-10-01 10:00','2026-10-01 12:00'),
      ('k-ana-sole','s1','f-sole','c-ana','2026-10-01 09:00',null,null),
      ('k-luis-carlos','s2','f-carlos','c-luis','2026-10-01 11:00',null,'2026-10-01 11:00');
    insert into mensajes (id,"conversacionId","autorId",tipo,contenido,evento,"createdAt") values
      ('m1','k-ana-carlos',null,'SISTEMA',null,'PRESUPUESTO_ENVIADO','2026-10-01 09:30'),
      ('m2','k-ana-carlos','u-ana','TEXTO','¿Llegás a las 9?',null,'2026-10-01 10:00'),
      ('m3','k-ana-carlos','u-carlos','TEXTO','Sí, ahí estoy',null,'2026-10-01 11:00'),
      ('m4','k-ana-carlos',null,'SISTEMA',null,'CARGA_REGISTRADA','2026-10-01 12:00'),
      ('m5','k-ana-sole','u-sole','TEXTO','Hola Ana',null,'2026-10-01 09:00'),
      ('m6','k-luis-carlos','u-carlos','TEXTO','Te paso presupuesto',null,'2026-10-01 11:00');
  `);
}, 120_000);

afterAll(async () => {
  await db?.close();
});

const bandeja = (lado: "CLIENTE" | "FLETERO", perfilId: string, userId: string) =>
  consultar<FilaBandeja>(consultaBandeja({ lado, perfilId, userId, limite: 50 }));

describe("bandeja de Ana (cliente)", () => {
  it("ordena por última actividad y solo trae sus conversaciones", async () => {
    const filas = await bandeja("CLIENTE", "c-ana", "u-ana");
    expect(filas.map((f) => f.id)).toEqual(["k-ana-carlos", "k-ana-sole"]);
  });

  it("cuenta como no leídos los mensajes del otro y los de sistema posteriores a su marca", async () => {
    const [carlos, sole] = await bandeja("CLIENTE", "c-ana", "u-ana");
    expect(carlos?.noLeidos).toBe(2); // m3 (de Carlos) y m4 (sistema); m2 es suyo
    expect(sole?.noLeidos).toBe(1); // sin marca de lectura: todo lo del otro
  });

  it("trae el último mensaje y la etapa del flete solo para el fletero del par", async () => {
    const [carlos, sole] = await bandeja("CLIENTE", "c-ana", "u-ana");
    expect(carlos).toMatchObject({
      ultimoTipo: "SISTEMA",
      ultimoEvento: "CARGA_REGISTRADA",
      fleteEtapa: "CARGANDO",
    });
    expect(sole).toMatchObject({
      fleteEtapa: null,
      presupuestoEstado: "RECHAZADO",
      fleteroNombre: "Soledad",
    });
  });

  it("el total de no leídos suma todas sus conversaciones", async () => {
    const [fila] = await consultar<{ total: number }>(
      consultaTotalNoLeidos({ lado: "CLIENTE", perfilId: "c-ana", userId: "u-ana" }),
    );
    expect(fila?.total).toBe(3);
  });
});

describe("bandeja de Carlos (fletero)", () => {
  it("ve sus dos conversaciones, con clientes distintos", async () => {
    const filas = await bandeja("FLETERO", "f-carlos", "u-carlos");
    expect(filas.map((f) => [f.id, f.clienteNombre])).toEqual([
      ["k-ana-carlos", "Ana"],
      ["k-luis-carlos", "Luis"],
    ]);
  });

  it("su marca de lectura deja en cero lo que ya vio", async () => {
    const [fila] = await consultar<{ total: number }>(
      consultaTotalNoLeidos({ lado: "FLETERO", perfilId: "f-carlos", userId: "u-carlos" }),
    );
    expect(fila?.total).toBe(0);
  });
});
