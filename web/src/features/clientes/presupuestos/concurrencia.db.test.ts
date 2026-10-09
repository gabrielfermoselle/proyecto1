import { describe, expect, it } from "vitest";
import { retirarPresupuesto } from "@/features/fleteros/presupuestos/actions";
import { cancelarSolicitud } from "@/features/clientes/solicitudes/actions";
import { crearCliente, crearFletero, crearSolicitud, presupuestar } from "../../../../test/db/fabrica";
import { contar, filas, uno } from "../../../../test/db/tabla";
import { comoUsuario, conPostgresReal } from "../../../../test/db/sesion";
import { aceptarPresupuesto } from "./actions";

// Carreras reales entre transacciones. PGlite es una sola sesión y serializa todo, así que estos
// tests solo tienen sentido contra Postgres (TEST_DATABASE_URL, en el CI). Cada caso se repite
// varias veces: una carrera que se gana "de casualidad" una vez no prueba nada.

const REPETICIONES = 5;

describe.runIf(conPostgresReal)("concurrencia sobre una misma solicitud", () => {
  it("dos aceptaciones simultáneas de presupuestos distintos crean un solo flete", async () => {
    for (let i = 0; i < REPETICIONES; i++) {
      const cliente = await crearCliente();
      const solicitud = await crearSolicitud(cliente);
      const a = await presupuestar(solicitud.id, await crearFletero("A"));
      const b = await presupuestar(solicitud.id, await crearFletero("B"));
      comoUsuario(cliente);

      const resultados = await Promise.all([
        aceptarPresupuesto({ presupuestoId: a.presupuestoId }),
        aceptarPresupuesto({ presupuestoId: b.presupuestoId }),
      ]);

      expect(resultados.filter((r) => r.ok)).toHaveLength(1);
      expect(await contar("fletes", { solicitudId: solicitud.id })).toBe(1);
      const estados = await filas<{ estado: string }>("presupuestos", { solicitudId: solicitud.id }, { columna: "estado" });
      expect(estados.map((e) => e.estado)).toEqual(["ACEPTADO", "RECHAZADO"]);
    }
  });

  it("aceptar y retirar el mismo presupuesto a la vez: gana uno y el otro falla limpio", async () => {
    for (let i = 0; i < REPETICIONES; i++) {
      const cliente = await crearCliente();
      const fletero = await crearFletero();
      const solicitud = await crearSolicitud(cliente);
      const { presupuestoId } = await presupuestar(solicitud.id, fletero);

      // createAction lee la sesión al invocarse, así que se puede cambiar entre llamadas.
      comoUsuario(cliente);
      const aceptar = aceptarPresupuesto({ presupuestoId });
      comoUsuario(fletero);
      const retirar = retirarPresupuesto({ presupuestoId });
      const [ra, rr] = await Promise.all([aceptar, retirar]);

      expect([ra.ok, rr.ok].filter(Boolean)).toHaveLength(1);
      const p = await uno<{ estado: string }>("presupuestos", { id: presupuestoId });
      const fletes = await contar("fletes", { solicitudId: solicitud.id });
      // Nunca un flete con un presupuesto retirado, ni un presupuesto aceptado sin flete.
      expect({ estado: p.estado, fletes }).toEqual(
        ra.ok ? { estado: "ACEPTADO", fletes: 1 } : { estado: "RETIRADO", fletes: 0 },
      );
    }
  });

  it("cancelar la solicitud mientras se acepta un presupuesto: nunca quedan las dos cosas", async () => {
    for (let i = 0; i < REPETICIONES; i++) {
      const cliente = await crearCliente();
      const solicitud = await crearSolicitud(cliente);
      const { presupuestoId } = await presupuestar(solicitud.id, await crearFletero());
      comoUsuario(cliente);

      const [ra, rc] = await Promise.all([
        aceptarPresupuesto({ presupuestoId }),
        cancelarSolicitud({ solicitudId: solicitud.id }),
      ]);

      expect([ra.ok, rc.ok].filter(Boolean)).toHaveLength(1);
      const s = await uno<{ estado: string }>("solicitudes", { id: solicitud.id });
      const fletes = await contar("fletes", { solicitudId: solicitud.id });
      expect({ estado: s.estado, fletes }).toEqual(
        ra.ok ? { estado: "ADJUDICADA", fletes: 1 } : { estado: "CANCELADA", fletes: 0 },
      );
    }
  });
});
