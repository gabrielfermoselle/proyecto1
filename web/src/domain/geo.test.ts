import { describe, expect, it } from "vitest";
import { aproximarCoordenadas, distanciaRutaKm, estaEnRegion, FACTOR_RUTA_URBANA, haversineKm } from "./geo";

const PLAZA_INDEPENDENCIA = { lat: -26.8303, lng: -65.2038 };
const YERBA_BUENA = { lat: -26.8163, lng: -65.2851 };

describe("haversineKm", () => {
  it("un grado de latitud sobre un meridiano mide ~111,195 km", () => {
    expect(haversineKm({ lat: 0, lng: 0 }, { lat: 1, lng: 0 })).toBeCloseTo(111.195, 3);
  });

  it("da 0 para el mismo punto", () => {
    expect(haversineKm(PLAZA_INDEPENDENCIA, PLAZA_INDEPENDENCIA)).toBe(0);
  });

  it("es simétrica", () => {
    expect(haversineKm(PLAZA_INDEPENDENCIA, YERBA_BUENA)).toBe(haversineKm(YERBA_BUENA, PLAZA_INDEPENDENCIA));
  });

  it("Plaza Independencia → Yerba Buena está a unos 8,2 km en línea recta", () => {
    expect(haversineKm(PLAZA_INDEPENDENCIA, YERBA_BUENA)).toBeCloseTo(8.23, 1);
  });

  it("rechaza coordenadas fuera de rango o no numéricas", () => {
    expect(() => haversineKm({ lat: 91, lng: 0 }, PLAZA_INDEPENDENCIA)).toThrow(RangeError);
    expect(() => haversineKm({ lat: Number.NaN, lng: 0 }, PLAZA_INDEPENDENCIA)).toThrow(RangeError);
  });
});

describe("distanciaRutaKm", () => {
  it("aplica el factor de recorrido urbano", () => {
    const lineal = haversineKm(PLAZA_INDEPENDENCIA, YERBA_BUENA);
    expect(distanciaRutaKm(PLAZA_INDEPENDENCIA, YERBA_BUENA)).toBeCloseTo(lineal * FACTOR_RUTA_URBANA, 10);
  });
});

describe("aproximarCoordenadas", () => {
  it("no se aleja más de ~250 m del punto real", () => {
    const aprox = aproximarCoordenadas(YERBA_BUENA);
    expect(haversineKm(aprox, YERBA_BUENA)).toBeLessThan(0.25);
  });

  it("dos puntos de la misma cuadra caen en la misma celda", () => {
    const a = aproximarCoordenadas({ lat: -26.8301, lng: -65.2041 });
    const b = aproximarCoordenadas({ lat: -26.8304, lng: -65.2036 });
    expect(a).toEqual(b);
  });
});

describe("estaEnRegion", () => {
  it("acepta el Gran Tucumán y rechaza otras provincias", () => {
    expect(estaEnRegion(PLAZA_INDEPENDENCIA)).toBe(true);
    expect(estaEnRegion({ lat: -27.05, lng: -65.4 })).toBe(true); // Famaillá
    expect(estaEnRegion({ lat: -34.6, lng: -58.38 })).toBe(false); // Buenos Aires
    expect(estaEnRegion({ lat: Number.NaN, lng: -65.2 })).toBe(false);
  });
});
