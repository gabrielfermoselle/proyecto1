import { describe, expect, it } from "vitest";
import { elegirResultados, partesConsulta, type FeaturePhoton } from "./geocoding";

const TUCUMAN = { city: "San Miguel de Tucumán", state: "Tucumán" };

function casa(street: string, housenumber: string, extra: FeaturePhoton["properties"] = {}): FeaturePhoton {
  return {
    geometry: { coordinates: [-65.2, -26.8] },
    properties: { type: "house", street, housenumber, ...TUCUMAN, ...extra },
  };
}

function calle(name: string, extra: FeaturePhoton["properties"] = {}): FeaturePhoton {
  return {
    geometry: { coordinates: [-65.3, -26.8] },
    properties: { type: "street", name, ...TUCUMAN, ...extra },
  };
}

const direcciones = (features: FeaturePhoton[], texto: string) =>
  elegirResultados(features, texto).map((r) => [r.direccion, r.aproximada]);

describe("partesConsulta", () => {
  it("separa la altura de la calle e ignora prefijos y acentos", () => {
    expect(partesConsulta("Av. Crisóstomo Álvarez 1000")).toEqual({
      palabras: ["crisostomo", "alvarez"],
      altura: "1000",
    });
    expect(partesConsulta("Av Aconquija 1450 Yerba Buena")).toEqual({
      palabras: ["aconquija", "yerba", "buena"],
      altura: "1450",
    });
  });

  it("un número al principio es parte del nombre de la calle", () => {
    expect(partesConsulta("24 de Septiembre 932")).toEqual({ palabras: ["24", "septiembre"], altura: "932" });
    expect(partesConsulta("24 de Septiembre")).toEqual({ palabras: ["24", "septiembre"], altura: null });
  });
});

describe("elegirResultados", () => {
  it("deja la dirección exacta y descarta otras provincias", () => {
    const features = [
      casa("Laprida", "463", { locality: "Barrio Norte" }),
      casa("Narciso Laprida", "463", { city: "Aguilares" }),
      casa("Perú", "1253", { city: "Santiago del Estero", state: "Santiago del Estero" }),
    ];
    expect(direcciones(features, "Laprida 463")).toEqual([
      ["Laprida 463, Barrio Norte, San Miguel de Tucumán", false],
      ["Narciso Laprida 463, Aguilares", false],
    ]);
  });

  it("no sugiere otra calle con el mismo número", () => {
    const features = [
      casa("Avenida Jujuy", "1870", { name: "Propanorte S.A." }),
      casa("Avenida Mate de Luna", "1870"),
      casa("Juan B. Alberdi", "1300"),
      casa("Muñecas", "850", { name: "Liceo Remedios Escalada de San Martín" }),
    ];
    expect(direcciones(features, "Avenida Roca 1870")).toEqual([]);
    expect(direcciones(features, "Juan B Justo 1300")).toEqual([]);
    expect(direcciones(features, "San Martin 850")).toEqual([]);
  });

  it("si falta la altura, ofrece la calle con la altura escrita como aproximada", () => {
    const features = [
      casa("Avenida Solano Vera", "950", { city: "Yerba Buena" }),
      calle("Avenida Solano Vera", { city: "Yerba Buena" }),
      calle("24 de Setiembre de 1812"),
      calle("Avenida Juan B. Justo"),
    ];
    expect(direcciones(features, "Av Solano Vera 300")).toEqual([
      ["Avenida Solano Vera 300, Yerba Buena", true],
    ]);
    expect(direcciones(features, "24 de Septiembre 932")).toEqual([
      ["24 de Setiembre de 1812 932, San Miguel de Tucumán", true],
    ]);
    expect(direcciones(features, "Juan B Justo 1300")).toEqual([
      ["Avenida Juan B. Justo 1300, San Miguel de Tucumán", true],
    ]);
  });

  it("sin altura, devuelve todo lo de Tucumán sin repetir", () => {
    const features = [
      calle("Las Piedras"),
      calle("Las Piedras"),
      calle("Las Piedras", { city: "Catamarca", state: "Catamarca" }),
    ];
    expect(direcciones(features, "Las Piedras")).toEqual([["Las Piedras, San Miguel de Tucumán", false]]);
  });
});
