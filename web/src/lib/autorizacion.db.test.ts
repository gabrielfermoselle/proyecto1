import { randomUUID } from "node:crypto";
import { readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { fechaIsoAr, sumarDias } from "@/domain/fechas";
import type { Rol } from "@/domain/roles";
import { aceptarPresupuesto } from "@/features/clientes/presupuestos/actions";
import { proponerHorario } from "@/features/chat/actions";
import { prisma } from "@/lib/prisma";
import type { ActionResult } from "@/lib/action-result";
import type { UsuarioActual } from "@/lib/session";
import {
  crearAdmin,
  crearCliente,
  crearFletero,
  crearSolicitud,
  error,
  ok,
  presupuestar,
} from "../../test/db/fabrica";
import { comoUsuario } from "../../test/db/sesion";

// Matriz de autorización (OWASP A01): para CADA Server Action de la app se verifica que
//  1. sin sesión, falla;
//  2. con un rol que no le corresponde, falla con "sin permiso";
//  3. con el rol correcto pero sobre un recurso de OTRO usuario, falla como si no existiera
//     (sin revelar que existe) y sin modificar nada.
// El último test recorre todos los `actions.ts` del proyecto: una acción nueva que no esté en
// esta matriz hace fallar la suite.

type Accion = (input: never) => Promise<ActionResult<unknown>>;
type Mundo = Awaited<ReturnType<typeof crearMundo>>;
type Intrusion = { como: UsuarioActual; input: unknown; esperado?: RegExp };
interface Caso {
  roles: readonly Rol[];
  /** Sin sesión no aplica: la acción es pública (registro). */
  publica?: true;
  /** Intento sobre un recurso ajeno. Ausente si la acción solo opera sobre lo propio. */
  ajeno?: (m: Mundo) => Intrusion;
}

const TODOS_LOS_ROLES: readonly Rol[] = ["CLIENTE", "FLETERO", "ADMIN"];
const NO_EXISTE = /No encontramos|ya no se puede|vehículos activos/;

/** Recursos de un cliente y un fletero "dueños", más dos intrusos con los mismos roles. */
async function crearMundo() {
  const cliente = await crearCliente("Duenia");
  const fletero = await crearFletero("Duenio");
  const otroCliente = await crearCliente("Intrusa");
  const otroFletero = await crearFletero("Intruso");
  const admin = await crearAdmin();

  // Una solicitud en negociación (con presupuesto, chat y una propuesta de horario)...
  const abierta = await crearSolicitud(cliente);
  const negociacion = await presupuestar(abierta.id, fletero);
  comoUsuario(fletero);
  ok(
    await proponerHorario({
      conversacionId: negociacion.conversacionId,
      clientId: randomUUID(),
      fecha: sumarDias(fechaIsoAr(), 5),
      franja: "TARDE",
    }),
  );
  const propuesta = await prisma.propuestaHorario.findFirstOrThrow({
    where: { mensaje: { conversacionId: negociacion.conversacionId } },
  });

  // ...y otra con el flete ya confirmado.
  const adjudicada = await crearSolicitud(cliente);
  const { presupuestoId } = await presupuestar(adjudicada.id, fletero);
  comoUsuario(cliente);
  const { fleteId } = ok(await aceptarPresupuesto({ presupuestoId }));

  const fotoSolicitud = await prisma.foto.create({
    data: { ruta: `solicitudes/${abierta.id}/${randomUUID()}.jpg`, solicitudId: abierta.id },
  });
  const fotoVehiculo = await prisma.foto.create({
    data: {
      ruta: `vehiculos/${fletero.fleteroProfile!.id}/${randomUUID()}.jpg`,
      vehiculoId: fletero.vehiculoId,
    },
  });
  const notificacion = await prisma.notificacion.create({
    data: { userId: cliente.id, tipo: "MENSAJE", titulo: "Hola", href: "/cliente" },
  });

  return {
    cliente,
    fletero,
    otroCliente,
    otroFletero,
    admin,
    abierta,
    presupuestoId: negociacion.presupuestoId,
    conversacionId: negociacion.conversacionId,
    propuestaId: propuesta.id,
    fleteId,
    itemId: adjudicada.items[0]!.id,
    fotoSolicitudId: fotoSolicitud.id,
    fotoVehiculoId: fotoVehiculo.id,
    notificacionId: notificacion.id,
  };
}

const vehiculo = (id: string) => ({
  id,
  tipo: "CAMIONETA",
  marca: "Ford",
  modelo: "Ranger",
  anio: "",
  patente: "AB123CD",
  capacidadKg: "900",
  volumenM3: "4",
});
const fotoInput = { ruta: `x/${randomUUID()}.jpg`, ancho: 10, alto: 10 };

const MATRIZ: Record<string, Caso> = {
  // --- auth ---
  registrarUsuario: { roles: TODOS_LOS_ROLES, publica: true },
  // Opera sobre la cuenta de la sesión: no recibe IDs.
  cambiarContrasena: { roles: TODOS_LOS_ROLES },
  // Públicas: la autorización es tener el email o el token de un solo uso.
  solicitarRecuperacion: { roles: TODOS_LOS_ROLES, publica: true },
  restablecerContrasena: { roles: TODOS_LOS_ROLES, publica: true },

  // --- solicitudes (cliente) ---
  crearSolicitud: { roles: ["CLIENTE"] },
  cancelarSolicitud: {
    roles: ["CLIENTE"],
    ajeno: (m) => ({ como: m.otroCliente, input: { solicitudId: m.abierta.id } }),
  },
  prepararFotoSolicitud: {
    roles: ["CLIENTE"],
    ajeno: (m) => ({ como: m.otroCliente, input: { solicitudId: m.abierta.id } }),
  },
  agregarFotoSolicitud: {
    roles: ["CLIENTE"],
    ajeno: (m) => ({ como: m.otroCliente, input: { solicitudId: m.abierta.id, ...fotoInput } }),
  },
  quitarFotoSolicitud: {
    roles: ["CLIENTE"],
    ajeno: (m) => ({ como: m.otroCliente, input: { fotoId: m.fotoSolicitudId } }),
  },
  aceptarPresupuesto: {
    roles: ["CLIENTE"],
    ajeno: (m) => ({ como: m.otroCliente, input: { presupuestoId: m.presupuestoId } }),
  },

  // --- perfil del cliente (operan sobre el perfil de la sesión) ---
  guardarDatosCliente: { roles: ["CLIENTE"] },
  guardarDireccionHabitual: { roles: ["CLIENTE"] },

  // --- presupuestos (fletero) ---
  enviarPresupuesto: {
    roles: ["FLETERO"],
    // Presupuestar una solicitud ajena es legítimo; usar el vehículo de otro fletero, no.
    ajeno: (m) => ({
      como: m.otroFletero,
      input: {
        solicitudId: m.abierta.id,
        vehiculoId: m.fletero.vehiculoId,
        monto: 20_000,
        ayudantes: 0,
        validez: "48h",
        mensaje: "",
      },
    }),
  },
  retirarPresupuesto: {
    roles: ["FLETERO"],
    ajeno: (m) => ({ como: m.otroFletero, input: { presupuestoId: m.presupuestoId } }),
  },

  // --- perfil del fletero (todas operan sobre el perfil de la sesión) ---
  guardarDatos: { roles: ["FLETERO"] },
  crearVehiculo: { roles: ["FLETERO"] },
  guardarZona: { roles: ["FLETERO"] },
  guardarTarifas: { roles: ["FLETERO"] },
  guardarDisponibilidad: { roles: ["FLETERO"] },
  actualizarVehiculo: {
    roles: ["FLETERO"],
    ajeno: (m) => ({ como: m.otroFletero, input: vehiculo(m.fletero.vehiculoId) }),
  },
  cambiarEstadoVehiculo: {
    roles: ["FLETERO"],
    ajeno: (m) => ({ como: m.otroFletero, input: { id: m.fletero.vehiculoId, activo: false } }),
  },
  firmarSubidaFotoVehiculo: {
    roles: ["FLETERO"],
    ajeno: (m) => ({ como: m.otroFletero, input: { vehiculoId: m.fletero.vehiculoId } }),
  },
  agregarFotoVehiculo: {
    roles: ["FLETERO"],
    ajeno: (m) => ({ como: m.otroFletero, input: { vehiculoId: m.fletero.vehiculoId, ...fotoInput } }),
  },
  eliminarFotoVehiculo: {
    roles: ["FLETERO"],
    ajeno: (m) => ({ como: m.otroFletero, input: { fotoId: m.fotoVehiculoId } }),
  },
  // Los documentos son siempre los del fletero de la sesión: no reciben IDs.
  firmarSubidaDocumento: { roles: ["FLETERO"] },
  guardarDocumento: { roles: ["FLETERO"] },
  eliminarDocumento: { roles: ["FLETERO"] },

  // --- chat ---
  enviarMensaje: {
    roles: ["CLIENTE", "FLETERO"],
    ajeno: (m) => ({
      como: m.otroCliente,
      input: { conversacionId: m.conversacionId, clientId: randomUUID(), texto: "hola" },
    }),
  },
  prepararFotoChat: {
    roles: ["CLIENTE", "FLETERO"],
    ajeno: (m) => ({ como: m.otroFletero, input: { conversacionId: m.conversacionId } }),
  },
  enviarFotoChat: {
    roles: ["CLIENTE", "FLETERO"],
    ajeno: (m) => ({
      como: m.otroCliente,
      input: { conversacionId: m.conversacionId, clientId: randomUUID(), texto: "", ...fotoInput },
    }),
  },
  marcarLeido: {
    roles: ["CLIENTE", "FLETERO"],
    ajeno: (m) => ({
      como: m.otroFletero,
      input: { conversacionId: m.conversacionId, hasta: new Date().toISOString() },
    }),
  },
  proponerHorario: {
    roles: ["CLIENTE", "FLETERO"],
    ajeno: (m) => ({
      como: m.otroCliente,
      input: {
        conversacionId: m.conversacionId,
        clientId: randomUUID(),
        fecha: sumarDias(fechaIsoAr(), 3),
        franja: "MANANA",
      },
    }),
  },
  responderPropuesta: {
    roles: ["CLIENTE", "FLETERO"],
    ajeno: (m) => ({ como: m.otroCliente, input: { propuestaId: m.propuestaId, aceptar: true } }),
  },
  obtenerTokenRealtime: { roles: ["CLIENTE", "FLETERO"] },

  // --- fletes ---
  avanzarEtapa: {
    roles: ["CLIENTE", "FLETERO"],
    ajeno: (m) => ({ como: m.otroFletero, input: { fleteId: m.fleteId, hacia: "EN_CAMINO_A_ORIGEN" } }),
  },
  cancelarFlete: {
    roles: ["CLIENTE", "FLETERO"],
    ajeno: (m) => ({
      como: m.otroCliente,
      input: { fleteId: m.fleteId, motivo: "Ya no lo necesito, gracias" },
    }),
  },
  prepararFotoFlete: {
    roles: ["CLIENTE", "FLETERO"],
    ajeno: (m) => ({ como: m.otroFletero, input: { fleteId: m.fleteId } }),
  },
  registrarControl: {
    roles: ["CLIENTE", "FLETERO"],
    ajeno: (m) => ({
      como: m.otroFletero,
      input: { fleteId: m.fleteId, itemId: m.itemId, fase: "CARGA", resultado: "CARGADO", observacion: "" },
    }),
  },
  marcarTodos: {
    roles: ["CLIENTE", "FLETERO"],
    ajeno: (m) => ({ como: m.otroFletero, input: { fleteId: m.fleteId, fase: "CARGA" } }),
  },
  quitarControl: {
    roles: ["CLIENTE", "FLETERO"],
    ajeno: (m) => ({ como: m.otroFletero, input: { fleteId: m.fleteId, itemId: m.itemId, fase: "CARGA" } }),
  },
  calificarFlete: {
    roles: ["CLIENTE"],
    ajeno: (m) => ({ como: m.otroCliente, input: { fleteId: m.fleteId, puntaje: 1, comentario: "" } }),
  },

  // --- notificaciones: con IDs ajenos no falla, pero no marca nada ---
  marcarNotificacionesLeidas: { roles: TODOS_LOS_ROLES },

  // --- admin (poder global sobre la plataforma: no hay recurso "ajeno") ---
  cambiarEstadoUsuario: { roles: ["ADMIN"] },
  verificarFletero: { roles: ["ADMIN"] },
  resolverReclamo: { roles: ["ADMIN"] },
};

/** Todas las Server Actions exportadas por los `actions.ts` del proyecto. */
async function accionesDelProyecto(): Promise<Map<string, Accion>> {
  const raiz = join(process.cwd(), "src");
  const archivos: string[] = [];
  const recorrer = (dir: string) => {
    for (const nombre of readdirSync(dir)) {
      const ruta = join(dir, nombre);
      if (statSync(ruta).isDirectory()) recorrer(ruta);
      else if (nombre === "actions.ts") archivos.push(ruta);
    }
  };
  recorrer(raiz);
  const acciones = new Map<string, Accion>();
  for (const archivo of archivos) {
    const modulo = (await import(
      /* @vite-ignore */ `@/${relative(raiz, archivo).replaceAll("\\", "/").replace(/\.ts$/, "")}`
    )) as Record<string, unknown>;
    for (const [nombre, valor] of Object.entries(modulo)) {
      if (typeof valor !== "function") continue;
      if (acciones.has(nombre)) throw new Error(`Dos Server Actions se llaman igual: ${nombre}`);
      acciones.set(nombre, valor as Accion);
    }
  }
  return acciones;
}

let acciones: Map<string, Accion>;
let mundo: Mundo;
const usuarioDeRol = (rol: Rol) =>
  rol === "CLIENTE" ? mundo.otroCliente : rol === "FLETERO" ? mundo.otroFletero : mundo.admin;

beforeAll(async () => {
  acciones = await accionesDelProyecto();
  mundo = await crearMundo();
}, 120_000);

describe("matriz de autorización", () => {
  it("cubre todas las Server Actions del proyecto (una acción nueva tiene que sumarse acá)", () => {
    expect([...acciones.keys()].sort()).toEqual(Object.keys(MATRIZ).sort());
  });

  describe.each(Object.entries(MATRIZ))("%s", (nombre, caso) => {
    const accion = () => acciones.get(nombre)!;

    it.skipIf(caso.publica)("sin sesión, falla", async () => {
      comoUsuario(null);
      expect(error(await accion()({} as never))).toMatch(/sesión expiró/);
    });

    const prohibidos = TODOS_LOS_ROLES.filter((r) => !caso.roles.includes(r));
    it.skipIf(caso.publica || prohibidos.length === 0)(
      `con rol ${prohibidos.join(" o ")}, no tiene permiso`,
      async () => {
        for (const rol of prohibidos) {
          comoUsuario(usuarioDeRol(rol));
          const r = await accion()({} as never);
          expect(r, `rol ${rol}`).toMatchObject({
            ok: false,
            error: expect.stringMatching(/No tenés permiso/),
          });
        }
      },
    );

    it.skipIf(!caso.ajeno)("sobre un recurso ajeno, falla como si no existiera", async () => {
      const { como, input, esperado = NO_EXISTE } = caso.ajeno!(mundo);
      comoUsuario(como);
      const mensaje = error(await accion()(input as never));
      expect(mensaje).toMatch(esperado);
      expect(mensaje).not.toMatch(/permiso/);
    });
  });
});

describe("el recurso ajeno no se modificó", () => {
  it("después de todos los intentos, todo sigue como estaba", async () => {
    const [presupuesto, flete, foto, fotoVehiculo, propuesta, vehiculoDuenio, solicitud, textosIntrusos] =
      await Promise.all([
        prisma.presupuesto.findUniqueOrThrow({ where: { id: mundo.presupuestoId } }),
        prisma.flete.findUniqueOrThrow({ where: { id: mundo.fleteId } }),
        prisma.foto.findUnique({ where: { id: mundo.fotoSolicitudId } }),
        prisma.foto.findUnique({ where: { id: mundo.fotoVehiculoId } }),
        prisma.propuestaHorario.findUniqueOrThrow({ where: { id: mundo.propuestaId } }),
        prisma.vehiculo.findUniqueOrThrow({ where: { id: mundo.fletero.vehiculoId } }),
        prisma.solicitud.findUniqueOrThrow({ where: { id: mundo.abierta.id } }),
        prisma.mensaje.count({
          where: {
            conversacionId: mundo.conversacionId,
            autorId: { in: [mundo.otroCliente.id, mundo.otroFletero.id] },
          },
        }),
      ]);
    expect(presupuesto.estado).toBe("PENDIENTE");
    expect(flete.etapa).toBe("CONFIRMADO");
    expect(foto).not.toBeNull();
    expect(fotoVehiculo).not.toBeNull();
    expect(propuesta.estado).toBe("PENDIENTE");
    expect(vehiculoDuenio).toMatchObject({ activo: true, marca: "Ford" });
    expect(solicitud.estado).toBe("ABIERTA");
    expect(textosIntrusos).toBe(0);
  });

  it("marcar notificaciones con IDs ajenos no marca nada", async () => {
    comoUsuario(mundo.otroCliente);
    expect(
      ok(await acciones.get("marcarNotificacionesLeidas")!({ ids: [mundo.notificacionId] } as never)),
    ).toEqual({
      marcadas: 0,
    });
    const n = await prisma.notificacion.findUniqueOrThrow({ where: { id: mundo.notificacionId } });
    expect(n.leidaEn).toBeNull();
  });
});
