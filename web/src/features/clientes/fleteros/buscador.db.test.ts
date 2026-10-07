import { describe, expect, it } from "vitest";
import { FACTOR_RUTA_URBANA } from "@/domain/geo";
import { precioSugerido } from "@/domain/precio";
import { prisma } from "@/lib/prisma";
import { crearCliente, crearFletero, crearSolicitud } from "../../../../test/db/fabrica";
import { leerParametrosBuscador } from "./parametros";
import { buscarFleteros, resolverReferencia } from "./queries";

// Referencia del buscador (de quién es la solicitud, qué pasa sin dirección) y el armado de
// cada tarjeta con la base real.

const filtros = {
  radio: null,
  tipoVehiculo: null,
  soloDisponibles: true,
  precioMaximo: null,
  ratingMinimo: null,
  orden: "distancia" as const,
};

describe("referencia del buscador", () => {
  it("sin dirección habitual ni otra referencia, busca sin punto", async () => {
    const c = await crearCliente();
    const r = await resolverReferencia(c.clienteProfile!.id, leerParametrosBuscador({}));
    expect(r).toEqual({ tipo: "habitual", punto: null, etiqueta: null, carga: null });
  });

  it("usa el origen y la carga de una solicitud abierta propia", async () => {
    const c = await crearCliente();
    const s = await crearSolicitud(c);
    const r = await resolverReferencia(
      c.clienteProfile!.id,
      leerParametrosBuscador({ ref: "solicitud", solicitud: s.id }),
    );
    expect(r.tipo).toBe("solicitud");
    expect(r.punto).toEqual({ lat: -26.8405, lng: -65.2062 });
    expect(r.carga).toEqual({ distanciaKm: 3.2, pesoTotalKg: 0, volumenTotalM3: 0, ayudantes: 0 });
  });

  it("ignora la solicitud de otro cliente: no revela su origen ni su carga", async () => {
    const duenia = await crearCliente("Duenia");
    const ajena = await crearSolicitud(duenia);
    const intrusa = await crearCliente("Intrusa");

    const r = await resolverReferencia(
      intrusa.clienteProfile!.id,
      leerParametrosBuscador({ ref: "solicitud", solicitud: ajena.id }),
    );
    expect(r).toEqual({ tipo: "habitual", punto: null, etiqueta: null, carga: null });
  });

  it("ignora una solicitud propia que ya no está abierta", async () => {
    const c = await crearCliente();
    const s = await crearSolicitud(c, { estado: "ADJUDICADA" });
    const r = await resolverReferencia(c.clienteProfile!.id, leerParametrosBuscador({ ref: "solicitud", solicitud: s.id }));
    expect(r.carga).toBeNull();
  });
});

describe("tarjetas del buscador", () => {
  it("con una solicitud, muestra distancia, si lo cubre y el precio estimado del dominio", async () => {
    const f = await crearFletero("Cercano");
    // La base de los tests es compartida: con las tarifas más bajas queda primero por precio.
    await prisma.fleteroProfile.update({
      where: { id: f.fleteroProfile!.id },
      data: { precioMinimo: 100, precioPorKm: 1, precioPorM3: 0, precioPorAyudante: 0 },
    });
    const c = await crearCliente();
    const s = await crearSolicitud(c);
    const referencia = await resolverReferencia(
      c.clienteProfile!.id,
      leerParametrosBuscador({ ref: "solicitud", solicitud: s.id }),
    );

    const lista = await buscarFleteros({ ...filtros, referencia, orden: "precio" });
    const tarjeta = lista.find((t) => t.id === f.fleteroProfile!.id);

    expect(tarjeta).toBeDefined();
    expect(tarjeta!.distanciaKm).toBeGreaterThan(2);
    expect(tarjeta!.cubreZona).toBe(true); // radio de 30 km
    const perfil = await prisma.fleteroProfile.findUniqueOrThrow({ where: { id: f.fleteroProfile!.id } });
    expect(tarjeta!.precioEstimado).toBe(
      precioSugerido(
        { distanciaLinealKm: 3.2, volumenM3: 0, ayudantes: 0 },
        {
          precioMinimo: perfil.precioMinimo.toNumber(),
          precioPorKm: perfil.precioPorKm.toNumber(),
          precioPorM3: perfil.precioPorM3.toNumber(),
          precioPorAyudante: perfil.precioPorAyudante.toNumber(),
        },
      ),
    );
    expect(FACTOR_RUTA_URBANA).toBeGreaterThan(1);
  });

  it("sin referencia no hay distancia ni precio estimado, y se puede ordenar igual", async () => {
    await crearFletero("Cualquiera");
    const lista = await buscarFleteros({
      ...filtros,
      referencia: { tipo: "habitual", punto: null, etiqueta: null, carga: null },
    });
    expect(lista.length).toBeGreaterThan(0);
    expect(lista.every((t) => t.distanciaKm === null && t.precioEstimado === null && t.cubreZona === null)).toBe(
      true,
    );
  });
});
