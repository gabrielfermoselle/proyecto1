import { describe, expect, it } from "vitest";
import { crearCliente, crearFletero, error, ok } from "../../../../test/db/fabrica";
import { uno } from "../../../../test/db/tabla";
import { comoUsuario } from "../../../../test/db/sesion";
import { guardarDatosCliente, guardarDireccionHabitual } from "./actions";
import { getDireccionHabitual, getPerfilCliente } from "./queries";

// Perfil del cliente: datos personales y dirección habitual (punto por defecto del buscador).

const direccion = { direccionHabitual: "Av. Roca 420, Barrio Sur", lat: -26.8405, lng: -65.2062 };

describe("datos del cliente", () => {
  it("guarda nombre, apellido y teléfono normalizado", async () => {
    const c = await crearCliente();
    comoUsuario(c);

    ok(await guardarDatosCliente({ nombre: "Lucía", apellido: "Pérez", telefono: "381 411-2222" }));

    const u = await uno("usuarios", { id: c.id });
    expect(u).toMatchObject({ nombre: "Lucía", apellido: "Pérez", telefono: "3814112222" });
  });

  it("el teléfono es opcional y vacío se guarda como null", async () => {
    const c = await crearCliente();
    comoUsuario(c);

    ok(await guardarDatosCliente({ nombre: "Ana", apellido: "Prueba", telefono: "" }));

    expect((await uno<{ telefono: string | null }>("usuarios", { id: c.id })).telefono).toBeNull();
  });

  it.each([
    ["un nombre con números", { nombre: "Ana2" }, "nombre"],
    ["un teléfono incompleto", { telefono: "381" }, "telefono"],
  ])("rechaza %s", async (_caso, cambio, campo) => {
    comoUsuario(await crearCliente());

    const r = await guardarDatosCliente({ nombre: "Ana", apellido: "Prueba", telefono: "", ...cambio });
    expect(r.ok ? undefined : r.fieldErrors?.[campo]).toBeDefined();
  });

  it("un fletero no puede usarlas", async () => {
    comoUsuario(await crearFletero());

    expect(error(await guardarDatosCliente({ nombre: "X", apellido: "Y", telefono: "" }))).toMatch(
      /No tenés permiso/,
    );
  });
});

describe("dirección habitual", () => {
  it("se guarda en el perfil de la sesión y la usa el buscador", async () => {
    const c = await crearCliente();
    comoUsuario(c);
    expect(await getDireccionHabitual(c.clienteProfile!.id)).toBeNull();

    ok(await guardarDireccionHabitual(direccion));

    expect(await getDireccionHabitual(c.clienteProfile!.id)).toEqual({
      direccion: direccion.direccionHabitual,
      lat: direccion.lat,
      lng: direccion.lng,
    });
    expect((await getPerfilCliente(c.clienteProfile!.id)).direccion).toEqual(direccion);
  });

  it("rechaza un punto fuera de Tucumán", async () => {
    comoUsuario(await crearCliente());

    const r = await guardarDireccionHabitual({ ...direccion, lat: -34.6037, lng: -58.3816 });
    expect(r.ok ? undefined : r.fieldErrors?.direccionHabitual).toBeDefined();
  });

  it("no toca el perfil de otro cliente", async () => {
    const otro = await crearCliente("Otra");
    comoUsuario(await crearCliente());

    ok(await guardarDireccionHabitual(direccion));

    expect(await getDireccionHabitual(otro.clienteProfile!.id)).toBeNull();
  });
});
