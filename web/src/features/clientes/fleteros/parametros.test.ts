import { describe, expect, it } from "vitest";
import { direccionEscrita, leerParametrosBuscador, radioDeUrl } from "./parametros";

describe("parámetros del buscador en la URL", () => {
  it("sin parámetros: dirección habitual, que lleguen al punto, más cerca primero", () => {
    expect(leerParametrosBuscador({})).toEqual({ ref: "habitual", radio: "zona", orden: "distancia" });
  });

  it("los valores manipulados caen en el valor por defecto o se descartan", () => {
    const p = leerParametrosBuscador({
      ref: "otra",
      radio: "1000",
      orden: "DROP TABLE",
      vehiculo: "AVION",
      precioMax: "-5",
      rating: "6",
      todos: "si",
    });
    expect(p).toEqual({ ref: "habitual", radio: "zona", orden: "distancia" });
  });

  it("los campos vacíos del formulario son 'sin filtro'", () => {
    expect(leerParametrosBuscador({ vehiculo: "", precioMax: "", rating: "" })).toEqual({
      ref: "habitual",
      radio: "zona",
      orden: "distancia",
    });
  });

  it("lee filtros válidos", () => {
    expect(
      leerParametrosBuscador({ vehiculo: "CAMION", precioMax: "25000", rating: "4.5", orden: "precio", todos: "1" }),
    ).toMatchObject({ vehiculo: "CAMION", precioMax: 25000, rating: "4.5", orden: "precio", todos: "1" });
  });

  it("una dirección escrita solo vale si está en Tucumán", () => {
    const tucuman = leerParametrosBuscador({ ref: "direccion", lat: "-26.83", lng: "-65.2", dir: "Plaza" });
    expect(direccionEscrita(tucuman)).toEqual({ lat: -26.83, lng: -65.2, direccion: "Plaza" });

    const baires = leerParametrosBuscador({ ref: "direccion", lat: "-34.6", lng: "-58.38" });
    expect(direccionEscrita(baires)).toBeNull();
    expect(direccionEscrita(leerParametrosBuscador({ ref: "direccion" }))).toBeNull();
  });

  it("traduce el radio", () => {
    expect(radioDeUrl("zona")).toBe("zona");
    expect(radioDeUrl("todos")).toBeNull();
    expect(radioDeUrl("20")).toBe(20);
  });
});
