import { describe, expect, it } from "vitest";
import { crearAdmin, crearCliente, crearFletero, crearSolicitud, error, ok } from "../../../test/db/fabrica";
import { comoUsuario } from "../../../test/db/sesion";
import { actualizar, filas, insertar, uno } from "../../../test/db/tabla";
import { cambiarEstadoUsuario, resolverReclamo, verificarFletero } from "./actions";

/** Un reclamo abierto sobre un flete entregado (armado directo en la base). */
async function reclamoAbierto() {
  const cliente = await crearCliente();
  const fletero = await crearFletero();
  const s = await crearSolicitud(cliente, { items: 1, estado: "ADJUDICADA" });
  const presupuesto = await insertar<{ id: string }>("presupuestos", {
    solicitudId: s.id,
    fleteroId: fletero.fleteroProfile!.id,
    vehiculoId: fletero.vehiculoId,
    monto: 1000,
    montoSugerido: 1000,
    validoHasta: new Date(),
    estado: "ACEPTADO",
  });
  const flete = await insertar<{ id: string }>("fletes", {
    solicitudId: s.id,
    presupuestoId: presupuesto.id,
    clienteId: cliente.clienteProfile!.id,
    fleteroId: fletero.fleteroProfile!.id,
    vehiculoId: fletero.vehiculoId,
    precioAcordado: 1000,
    etapa: "CERRADO",
  });
  const reclamo = await insertar<{ id: string }>("reclamos", {
    itemId: s.items[0]!.id,
    fleteId: flete.id,
    autorId: cliente.id,
    descripcion: "Llegó roto",
  });
  return { cliente, fletero, reclamoId: reclamo.id };
}

describe("administración", () => {
  it("solo un admin puede usar las acciones de administración", async () => {
    const otro = await crearCliente();
    comoUsuario(await crearFletero());
    expect(error(await cambiarEstadoUsuario({ userId: otro.id, activo: false }))).toBe(
      "No tenés permiso para hacer esto.",
    );
  });

  it("desactiva y reactiva cuentas, pero no la propia ni la de otro admin", async () => {
    const admin = await crearAdmin();
    const otroAdmin = await crearAdmin();
    const cliente = await crearCliente();
    comoUsuario(admin);
    ok(await cambiarEstadoUsuario({ userId: cliente.id, activo: false }));
    expect((await uno<{ activo: boolean }>("usuarios", { id: cliente.id })).activo).toBe(false);
    ok(await cambiarEstadoUsuario({ userId: cliente.id, activo: true }));
    expect(error(await cambiarEstadoUsuario({ userId: admin.id, activo: false }))).toMatch(
      /tu propia cuenta/,
    );
    expect(error(await cambiarEstadoUsuario({ userId: otroAdmin.id, activo: false }))).toMatch(
      /no se puede modificar/,
    );
  });

  it("verifica fleteros con el perfil completo", async () => {
    const fletero = await crearFletero();
    comoUsuario(await crearAdmin());
    ok(await verificarFletero({ fleteroId: fletero.fleteroProfile!.id, verificado: true }));
    expect(
      (await uno<{ verificado: boolean }>("perfiles_fletero", { id: fletero.fleteroProfile!.id })).verificado,
    ).toBe(true);
  });

  it("resuelve un reclamo una sola vez y les avisa a las dos partes", async () => {
    const { cliente, fletero, reclamoId } = await reclamoAbierto();
    const admin = await crearAdmin();
    comoUsuario(admin);
    expect(error(await resolverReclamo({ reclamoId, resolucion: "corto" }))).toBe(
      "Revisá los datos marcados.",
    );
    ok(await resolverReclamo({ reclamoId, resolucion: "El fletero reintegra el 20 % del precio." }));
    expect(error(await resolverReclamo({ reclamoId, resolucion: "Otra resolución distinta" }))).toMatch(
      /ya fue resuelto/,
    );

    const reclamo = await uno<{ estado: string; resueltoPorId: string | null }>("reclamos", { id: reclamoId });
    expect(reclamo.estado).toBe("RESUELTO");
    expect(reclamo.resueltoPorId).toBe(admin.id);
    const avisos = (
      await Promise.all([
        filas<{ userId: string; titulo: string; href: string }>("notificaciones", { userId: cliente.id }),
        filas<{ userId: string; titulo: string; href: string }>("notificaciones", { userId: fletero.id }),
      ])
    )
      .flat()
      .filter((a) => a.titulo.includes("Se resolvió el reclamo"))
      .map((a) => ({ userId: a.userId, href: a.href }));
    expect(avisos).toHaveLength(2);
    expect(avisos.find((a) => a.userId === cliente.id)?.href).toMatch(/^\/cliente\/pedido\//);
  });

  it("la base no admite un reclamo resuelto sin resolución", async () => {
    const { reclamoId } = await reclamoAbierto();
    await expect(actualizar("reclamos", { id: reclamoId }, { estado: "RESUELTO" })).rejects.toThrow();
  });
});
