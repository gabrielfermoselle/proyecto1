import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import {
  cargarUsuario,
  crearCliente,
  crearFletero,
  crearSolicitud,
  error,
  ok,
  presupuestar,
} from "../../../../test/db/fabrica";
import { comoUsuario, conPostgresReal } from "../../../../test/db/sesion";
import {
  actualizarVehiculo,
  cambiarEstadoVehiculo,
  crearVehiculo,
  guardarDatos,
  guardarDisponibilidad,
  guardarTarifas,
  guardarZona,
} from "./actions";

// Perfil del fletero: onboarding, vehículos, zona y tarifas. Todas las acciones filtran por el
// fleteroId de la sesión, así que un ID ajeno tiene que comportarse como "no existe".

/** Fletero recién registrado: perfil vacío, sin vehículos ni zona. */
async function fleteroNuevo() {
  const u = await prisma.user.create({
    data: {
      email: `nuevo-${randomUUID().slice(0, 8)}@test.local`,
      passwordHash: "x",
      nombre: "Nuevo",
      apellido: "Prueba",
      rol: "FLETERO",
      fleteroProfile: { create: {} },
    },
    select: { id: true },
  });
  return cargarUsuario(u.id);
}

// Formato AB123CD con las cuatro letras al azar (~450 millones de combinaciones): con menos, dos
// tests chocaban de vez en cuando y la violación de único deja colgada la conexión de PGlite.
const letra = () => String.fromCharCode(65 + Math.floor(Math.random() * 26));
const patenteUnica = () =>
  `${letra()}${letra()}${String(Math.floor(Math.random() * 1000)).padStart(3, "0")}${letra()}${letra()}`;

const vehiculo = (patente = patenteUnica()) => ({
  tipo: "CAMIONETA" as const,
  marca: "Toyota",
  modelo: "Hilux",
  anio: 2018,
  patente,
  capacidadKg: 900,
  volumenM3: 4,
});

const zona = {
  baseDireccion: "Av. Mate de Luna 2400",
  baseLat: -26.8211,
  baseLng: -65.2302,
  radioCoberturaKm: 20,
};
const tarifas = { precioMinimo: 15000, precioPorKm: 900, precioPorM3: 1500, precioPorAyudante: 6000 };
const datos = (dni: string) => ({
  nombre: "Raúl",
  apellido: "Gómez",
  telefono: "381 411 2222",
  dni,
  bio: "",
});
const dniUnico = () => String(20_000_000 + Math.floor(Math.random() * 9_999_999));

describe("onboarding", () => {
  it("las tarifas solas no completan el onboarding: devuelve los pasos pendientes", async () => {
    const f = await fleteroNuevo();
    comoUsuario(f);

    const r = ok(await guardarTarifas(tarifas));

    expect(r).toEqual({ completo: false, pendientes: ["datos", "vehiculos", "zona"] });
    const perfil = await prisma.fleteroProfile.findUniqueOrThrow({ where: { id: f.fleteroProfile!.id } });
    expect(perfil.onboardingCompletadoEn).toBeNull();
  });

  it("completar los cuatro pasos habilita la cuenta", async () => {
    const f = await fleteroNuevo();
    comoUsuario(f);

    ok(await guardarDatos(datos(dniUnico())));
    ok(await crearVehiculo(vehiculo()));
    ok(await guardarZona(zona));
    expect(ok(await guardarTarifas(tarifas))).toEqual({ completo: true, pendientes: [] });

    const perfil = await prisma.fleteroProfile.findUniqueOrThrow({ where: { id: f.fleteroProfile!.id } });
    expect(perfil.onboardingCompletadoEn).not.toBeNull();
  });

  it("sin onboarding no puede ponerse disponible", async () => {
    comoUsuario(await fleteroNuevo());

    expect(error(await guardarDisponibilidad({ disponible: true }))).toMatch(/Terminá de configurar/);
  });

  it("un cliente no puede usar las acciones del fletero", async () => {
    comoUsuario(await crearCliente());

    expect(error(await guardarTarifas(tarifas))).toMatch(/No tenés permiso/);
  });
});

describe("datos personales", () => {
  it("guarda el DNI sin puntos ni espacios", async () => {
    const dni = dniUnico();
    const a = await fleteroNuevo();
    comoUsuario(a);

    ok(await guardarDatos(datos(`${dni.slice(0, 2)}.${dni.slice(2, 5)}.${dni.slice(5)}`)));

    expect((await prisma.fleteroProfile.findUniqueOrThrow({ where: { id: a.fleteroProfile!.id } })).dni).toBe(
      dni,
    );
  });

  // La violación de único fuera de transacción rompe el protocolo de PGlite: solo en Postgres real.
  it.runIf(conPostgresReal)("no permite repetir un DNI entre fleteros", async () => {
    const dni = dniUnico();
    comoUsuario(await fleteroNuevo());
    ok(await guardarDatos(datos(dni)));

    comoUsuario(await fleteroNuevo());
    const r = await guardarDatos(datos(dni));
    expect(r.ok ? [] : r.fieldErrors?.dni).toEqual(["Ese DNI ya está registrado."]);
  });

  it("el teléfono es obligatorio para el fletero", async () => {
    comoUsuario(await fleteroNuevo());

    const r = await guardarDatos({ ...datos(dniUnico()), telefono: "" });
    expect(r.ok ? [] : r.fieldErrors?.telefono).toEqual([expect.stringMatching(/Necesitamos un teléfono/)]);
  });
});

describe("vehículos", () => {
  it("normaliza la patente (mayúsculas, sin espacios ni guiones)", async () => {
    const f = await crearFletero();
    comoUsuario(f);
    const patente = patenteUnica();
    const escrita = `${patente.slice(0, 2).toLowerCase()} ${patente.slice(2, 5)}-${patente.slice(5).toLowerCase()}`;

    const { id } = ok(await crearVehiculo(vehiculo(escrita)));

    expect((await prisma.vehiculo.findUniqueOrThrow({ where: { id } })).patente).toBe(patente);
  });

  it.runIf(conPostgresReal)("una patente no se puede registrar dos veces, ni por otro fletero", async () => {
    const patente = patenteUnica();
    comoUsuario(await crearFletero());
    ok(await crearVehiculo(vehiculo(patente)));

    comoUsuario(await crearFletero("Otro"));
    const r = await crearVehiculo(vehiculo(patente));
    expect(r.ok ? [] : r.fieldErrors?.patente).toEqual(["Esa patente ya está registrada en la plataforma."]);
  });

  it.each([
    ["patente con formato inválido", { patente: "XYZ" }, "patente"],
    ["capacidad en cero", { capacidadKg: 0 }, "capacidadKg"],
    ["volumen excesivo", { volumenM3: 500 }, "volumenM3"],
    ["año imposible", { anio: 1900 }, "anio"],
  ])("rechaza %s", async (_caso, cambio, campo) => {
    comoUsuario(await crearFletero());

    const r = await crearVehiculo({ ...vehiculo(), ...cambio });
    expect(r.ok).toBe(false);
    expect(r.ok ? undefined : r.fieldErrors?.[campo]).toBeDefined();
  });

  it("admite hasta 10 vehículos por fletero", async () => {
    const f = await crearFletero(); // ya tiene 1
    comoUsuario(f);
    for (let i = 0; i < 9; i++) ok(await crearVehiculo(vehiculo()));

    expect(error(await crearVehiculo(vehiculo()))).toMatch(/hasta 10 vehículos/);
  });

  it("no puede editar ni dar de baja el vehículo de otro fletero", async () => {
    const duenio = await crearFletero();
    comoUsuario(await crearFletero("Intruso"));

    expect(error(await actualizarVehiculo({ ...vehiculo(), id: duenio.vehiculoId }))).toMatch(
      /No encontramos ese vehículo/,
    );
    // Con un solo vehículo activo propio, la baja de uno ajeno no puede pasar ni por accidente.
    ok(await crearVehiculo(vehiculo()));
    expect(error(await cambiarEstadoVehiculo({ id: duenio.vehiculoId, activo: false }))).toMatch(
      /No encontramos ese vehículo/,
    );
    expect((await prisma.vehiculo.findUniqueOrThrow({ where: { id: duenio.vehiculoId } })).activo).toBe(true);
  });

  it("con el onboarding completo no puede quedarse sin vehículos activos", async () => {
    const f = await crearFletero();
    comoUsuario(f);

    expect(error(await cambiarEstadoVehiculo({ id: f.vehiculoId, activo: false }))).toMatch(
      /al menos un vehículo activo/,
    );
  });

  // BUG CONOCIDO (roadmap 1.7): hoy se puede dar de baja un vehículo comprometido en un
  // presupuesto pendiente, y el cliente acepta un flete con un vehículo que ya no está.
  // `it.fails` documenta el comportamiento esperado: cuando se corrija, este test empieza a
  // fallar y hay que pasarlo a `it`.
  it.fails("no permite dar de baja un vehículo con un presupuesto pendiente", async () => {
    const cliente = await crearCliente();
    const f = await crearFletero();
    const s = await crearSolicitud(cliente);
    await presupuestar(s.id, f);
    comoUsuario(f);
    ok(await crearVehiculo(vehiculo())); // otro activo, para no chocar con la regla del último

    expect(error(await cambiarEstadoVehiculo({ id: f.vehiculoId, activo: false }))).toMatch(/presupuesto/);
  });
});

describe("zona de trabajo", () => {
  it("guarda la base y la columna geográfica se calcula sola", async () => {
    const f = await fleteroNuevo();
    comoUsuario(f);

    ok(await guardarZona(zona));

    const [fila] = await prisma.$queryRaw<{ lat: number; lng: number }[]>`
      SELECT ST_Y("baseGeo"::geometry) AS lat, ST_X("baseGeo"::geometry) AS lng
      FROM fletero_profiles WHERE id = ${f.fleteroProfile!.id}`;
    expect(fila!.lat).toBeCloseTo(zona.baseLat, 5);
    expect(fila!.lng).toBeCloseTo(zona.baseLng, 5);
  });

  it.each([
    ["fuera de Tucumán (Buenos Aires)", { baseLat: -34.6037, baseLng: -58.3816 }, "baseDireccion"],
    ["con radio 0", { radioCoberturaKm: 0 }, "radioCoberturaKm"],
    ["con radio de más de 100 km", { radioCoberturaKm: 101 }, "radioCoberturaKm"],
  ])("rechaza una zona %s", async (_caso, cambio, campo) => {
    comoUsuario(await fleteroNuevo());

    const r = await guardarZona({ ...zona, ...cambio });
    expect(r.ok ? undefined : r.fieldErrors?.[campo]).toBeDefined();
  });
});

describe("tarifas", () => {
  it.each([
    ["mínimo en cero", { precioMinimo: 0 }, "precioMinimo"],
    ["precio por km negativo", { precioPorKm: -1 }, "precioPorKm"],
  ])("rechaza %s", async (_caso, cambio, campo) => {
    comoUsuario(await crearFletero());

    const r = await guardarTarifas({ ...tarifas, ...cambio });
    expect(r.ok ? undefined : r.fieldErrors?.[campo]).toBeDefined();
  });
});
