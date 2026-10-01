import { describe, expect, it } from "vitest";
import { direccionAproximada } from "./direccion";
import { pasosCompletos, pasoSiguiente, primerPasoPendiente, type PerfilParaOnboarding } from "./onboarding";
import { esPatenteValida, normalizarPatente } from "./patente";

describe("patente", () => {
  it("normaliza mayúsculas, espacios y guiones", () => {
    expect(normalizarPatente(" ab 123-cd ")).toBe("AB123CD");
  });

  it("acepta los cuatro formatos argentinos", () => {
    for (const patente of ["AB123CD", "abc 123", "A123BCD", "123ABC"]) {
      expect(esPatenteValida(patente), patente).toBe(true);
    }
  });

  it("rechaza formatos inválidos", () => {
    for (const patente of ["", "AB12CD", "1234567", "ABCD123", "AB123C"]) {
      expect(esPatenteValida(patente), patente).toBe(false);
    }
  });
});

describe("direccionAproximada", () => {
  it("quita la altura pero conserva calle, barrio y ciudad", () => {
    expect(direccionAproximada("Av. Roca 420, Barrio Sur, San Miguel de Tucumán")).toBe(
      "Av. Roca, Barrio Sur, San Miguel de Tucumán",
    );
    expect(direccionAproximada("Pasaje Padilla 1100")).toBe("Pasaje Padilla");
    expect(direccionAproximada("Lavalle N° 350, Yerba Buena")).toBe("Lavalle, Yerba Buena");
  });

  it("no rompe nombres de calles con números ni rutas", () => {
    expect(direccionAproximada("24 de Septiembre 550, San Miguel de Tucumán")).toBe(
      "24 de Septiembre, San Miguel de Tucumán",
    );
    expect(direccionAproximada("Av. 9 de Julio 400, San Isidro de Lules")).toBe(
      "Av. 9 de Julio, San Isidro de Lules",
    );
    expect(direccionAproximada("Ruta 338, El Manantial")).toBe("Ruta 338, El Manantial");
  });

  it("deja igual una dirección sin altura", () => {
    expect(direccionAproximada("Mercado de Abasto, San Miguel de Tucumán")).toBe(
      "Mercado de Abasto, San Miguel de Tucumán",
    );
  });
});

describe("onboarding", () => {
  const vacio: PerfilParaOnboarding = {
    dni: null,
    telefono: null,
    vehiculosActivos: 0,
    baseLat: null,
    baseLng: null,
    precioMinimo: 0,
    precioPorKm: 0,
  };

  it("un perfil recién creado arranca por los datos", () => {
    expect(primerPasoPendiente(vacio)).toBe("datos");
  });

  it("avanza al primer paso que falta", () => {
    expect(
      primerPasoPendiente({ ...vacio, dni: "30111222", telefono: "3814112222", vehiculosActivos: 1 }),
    ).toBe("zona");
  });

  it("está completo con todos los pasos", () => {
    const completo = {
      dni: "30111222",
      telefono: "3814112222",
      vehiculosActivos: 2,
      baseLat: -26.8,
      baseLng: -65.2,
      precioMinimo: 10_000,
      precioPorKm: 1_000,
    };
    expect(primerPasoPendiente(completo)).toBeNull();
    expect(Object.values(pasosCompletos(completo)).every(Boolean)).toBe(true);
  });

  it("las tarifas exigen mínimo y precio por km mayores a cero", () => {
    expect(pasosCompletos({ ...vacio, precioMinimo: 10_000 }).tarifas).toBe(false);
  });

  it("indica el paso siguiente", () => {
    expect(pasoSiguiente("datos")).toBe("vehiculos");
    expect(pasoSiguiente("tarifas")).toBeNull();
  });
});
