import { describe, expect, it } from "vitest";
import { destinoSeguro, esRol, esRutaPrivada, puedeAcceder, rolDeRuta, rutaComun } from "./roles";

describe("rolDeRuta", () => {
  it("identifica el área por prefijo de segmento completo", () => {
    expect(rolDeRuta("/cliente")).toBe("CLIENTE");
    expect(rolDeRuta("/fletero/agenda")).toBe("FLETERO");
    expect(rolDeRuta("/admin/usuarios/1")).toBe("ADMIN");
  });

  it("no confunde rutas que solo comparten el comienzo", () => {
    expect(rolDeRuta("/fleteros/abc")).toBeNull(); // perfil público
    expect(rolDeRuta("/clientes")).toBeNull();
    expect(rolDeRuta("/")).toBeNull();
  });
});

describe("puedeAcceder", () => {
  it("cada rol entra solo a su área", () => {
    expect(puedeAcceder("CLIENTE", "/cliente/fletes")).toBe(true);
    expect(puedeAcceder("CLIENTE", "/fletero")).toBe(false);
    expect(puedeAcceder("FLETERO", "/admin")).toBe(false);
    expect(puedeAcceder("ADMIN", "/cliente")).toBe(false);
  });

  it("las rutas públicas son libres para todos", () => {
    expect(puedeAcceder("FLETERO", "/fleteros/abc")).toBe(true);
  });
});

describe("destinoSeguro", () => {
  it("respeta un callback interno del área del rol", () => {
    expect(destinoSeguro("CLIENTE", "/cliente/fletes")).toBe("/cliente/fletes");
  });

  it("descarta URLs externas, protocol-relative o de otra área", () => {
    expect(destinoSeguro("CLIENTE", "https://malicioso.example")).toBe("/cliente");
    expect(destinoSeguro("CLIENTE", "//malicioso.example")).toBe("/cliente");
    expect(destinoSeguro("CLIENTE", "/fletero")).toBe("/cliente");
    expect(destinoSeguro("FLETERO", null)).toBe("/fletero");
  });
});

describe("esRol", () => {
  it("valida valores desconocidos", () => {
    expect(esRol("ADMIN")).toBe(true);
    expect(esRol("admin")).toBe(false);
    expect(esRol(undefined)).toBe(false);
  });
});

describe("secciones comunes", () => {
  it("reconoce chat, notificaciones y perfil como privadas sin dueño", () => {
    expect(rutaComun("/chat/abc")).toBe("/chat");
    expect(rutaComun("/perfil")).toBe("/perfil");
    expect(rutaComun("/chateo")).toBeNull();
    expect(rolDeRuta("/chat")).toBeNull();
    expect(esRutaPrivada("/notificaciones")).toBe(true);
    expect(esRutaPrivada("/fleteros/abc")).toBe(false);
  });

  it("el chat es de cliente y fletero; perfil y notificaciones, de todos", () => {
    expect(puedeAcceder("CLIENTE", "/chat/abc")).toBe(true);
    expect(puedeAcceder("FLETERO", "/chat")).toBe(true);
    expect(puedeAcceder("ADMIN", "/chat")).toBe(false);
    expect(puedeAcceder("ADMIN", "/perfil")).toBe(true);
  });

  it("acepta un callback a una sección común permitida", () => {
    expect(destinoSeguro("FLETERO", "/chat/abc")).toBe("/chat/abc");
    expect(destinoSeguro("ADMIN", "/chat/abc")).toBe("/admin");
    expect(destinoSeguro("CLIENTE", "/fleteros/abc")).toBe("/cliente");
  });
});
