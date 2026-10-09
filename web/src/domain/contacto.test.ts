import { describe, expect, it } from "vitest";
import { enlacesContacto, numeroNacional } from "./contacto";

describe("numeroNacional", () => {
  it("acepta los formatos con y sin código de país", () => {
    expect(numeroNacional("3814112222")).toBe("3814112222");
    expect(numeroNacional("543814112222")).toBe("3814112222");
    expect(numeroNacional("5493814112222")).toBe("3814112222");
    expect(numeroNacional("03814112222")).toBe("3814112222");
  });

  it("descarta lo que no es un número argentino completo", () => {
    expect(numeroNacional(null)).toBeNull();
    expect(numeroNacional("4112222")).toBeNull();
  });
});

describe("enlacesContacto", () => {
  it("arma WhatsApp con el 9 de celulares y la llamada con +54", () => {
    expect(enlacesContacto("3814112222", "Hola")).toEqual({
      whatsapp: "https://wa.me/5493814112222?text=Hola",
      llamar: "tel:+543814112222",
      visible: "381 411-2222",
    });
  });
});
