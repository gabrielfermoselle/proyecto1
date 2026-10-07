import "server-only";
import { Prisma, type EtapaFlete, type FaseControl, type ResultadoControl } from "@prisma/client";
import {
  CONFORMIDAD_DE_ETAPA,
  pendientesDeFase,
  RESULTADO_OK,
  resumenInventario,
  textoConformidad,
  validarControl,
  validarQuitarControl,
  validarTransicion,
  type Actor,
  type ItemControlado,
  type ResumenInventario,
} from "@/domain/ciclo-flete";
import { conEventos, type ContextoEventos } from "@/features/chat/eventos";
import { BUCKET_PRIVADO, eliminarArchivos } from "@/features/uploads/storage";
import { ActionError } from "@/lib/action";
import { aItemControlado } from "./inventario";
import { topicFlete } from "./rutas";
import type { Ubicacion } from "./schemas";

// Única puerta para cambiar un flete: etapas, controles del inventario y reclamos.
// Cada operación corre en una transacción que bloquea la fila del flete, vuelve a validar con
// el dominio (domain/ciclo-flete) sobre los datos bloqueados, deja el mensaje en el chat y
// avisa en vivo después del commit.

type Tx = Prisma.TransactionClient;

export interface ActorFlete {
  rol: Actor;
  userId: string;
  /** clienteId o fleteroId, según el rol: restringe el flete a sus participantes. */
  perfilId: string;
}

interface FleteBloqueado {
  etapa: EtapaFlete;
  solicitudId: string;
  fleteroId: string;
}

const NO_ENCONTRADO = "No encontramos ese flete.";

/**
 * Bloquea el flete si el actor participa. UPDATE para cambiar de etapa; SHARE para registrar
 * controles (varios a la vez, pero ninguno mientras cambia la etapa).
 */
async function bloquear(tx: Tx, fleteId: string, actor: ActorFlete, modo: "UPDATE" | "SHARE") {
  const participante =
    actor.rol === "CLIENTE"
      ? Prisma.sql`"clienteId" = ${actor.perfilId}`
      : Prisma.sql`"fleteroId" = ${actor.perfilId}`;
  const [flete] = await tx.$queryRaw<FleteBloqueado[]>`
    SELECT etapa, "solicitudId", "fleteroId" FROM fletes
    WHERE id = ${fleteId} AND ${participante}
    FOR ${Prisma.raw(modo)}`;
  if (!flete) throw new ActionError(NO_ENCONTRADO);
  return flete;
}

type ItemInventario = ItemControlado & { nombre: string };

async function inventario(tx: Tx, fleteId: string, solicitudId: string): Promise<ItemInventario[]> {
  const items = await tx.itemInventario.findMany({
    where: { solicitudId },
    orderBy: { orden: "asc" },
    select: {
      id: true,
      nombre: true,
      controles: { where: { fleteId }, select: { fase: true, resultado: true, observacion: true } },
    },
  });
  return items.map((i) => ({ ...aItemControlado(i.id, i.controles), nombre: i.nombre }));
}

const avisoEnVivo = (fleteId: string, motivo: string) => ({
  topic: topicFlete(fleteId),
  event: "flete.actualizado",
  payload: { motivo },
});

/** Mensaje de sistema que deja cada etapa en el chat. */
async function emitirEtapa(
  emitir: ContextoEventos["emitir"],
  base: { solicitudId: string; fleteroId: string },
  hacia: EtapaFlete,
  r: ResumenInventario,
  cancelacion: { motivo: string; por: Actor } | null,
) {
  switch (hacia) {
    case "EN_CAMINO_A_ORIGEN":
      return emitir({ ...base, evento: "EN_CAMINO_A_ORIGEN", datos: {} });
    case "CARGANDO":
      return emitir({ ...base, evento: "LLEGADA_ORIGEN", datos: {} });
    case "EN_TRASLADO":
      return emitir({
        ...base,
        evento: "CARGA_REGISTRADA",
        datos: { cargados: r.cargados, noCargados: r.noCargados, conObservacion: r.conObservacionAlCargar },
      });
    case "DESCARGANDO":
      return emitir({ ...base, evento: "LLEGADA_DESTINO", datos: {} });
    case "ENTREGADO":
      return emitir({
        ...base,
        evento: "DESCARGA_REGISTRADA",
        datos: { entregados: r.entregados, conDano: r.conDano, faltantes: r.faltantes },
      });
    case "CERRADO":
      return emitir({ ...base, evento: "FLETE_CERRADO", datos: { reclamos: r.reclamos } });
    case "CANCELADO":
      return cancelacion ? emitir({ ...base, evento: "FLETE_CANCELADO", datos: cancelacion }) : undefined;
    case "CONFIRMADO":
      // Lo emite la aceptación del presupuesto, que crea el flete.
      return undefined;
  }
}

export async function transicionar(p: {
  fleteId: string;
  actor: ActorFlete;
  hacia: EtapaFlete;
  ubicacion?: Ubicacion | null;
  motivo?: string | null;
  conformidad?: boolean;
}): Promise<{ etapa: EtapaFlete }> {
  return conEventos(async (tx, { emitir, publicarDespues }) => {
    const flete = await bloquear(tx, p.fleteId, p.actor, "UPDATE");
    const resumen = resumenInventario(await inventario(tx, p.fleteId, flete.solicitudId));
    const validacion = validarTransicion(flete.etapa, p.hacia, p.actor.rol, {
      inventario: resumen,
      conformidad: p.conformidad ?? false,
      motivo: p.motivo ?? null,
    });
    if (!validacion.ok) throw new ActionError(validacion.motivo);

    const ahora = new Date();
    await tx.flete.update({
      where: { id: p.fleteId },
      data: { etapa: p.hacia, ...(p.hacia === "CERRADO" ? { recepcionConfirmadaEn: ahora } : {}) },
    });
    // Solo se guarda la ubicación del fletero: la del cliente no le sirve a nadie.
    const ubicacion = p.actor.rol === "FLETERO" ? p.ubicacion : null;
    await tx.estadoFlete.create({
      data: {
        fleteId: p.fleteId,
        etapa: p.hacia,
        autorId: p.actor.userId,
        nota: p.hacia === "CANCELADO" ? (p.motivo ?? null) : null,
        lat: ubicacion?.lat ?? null,
        lng: ubicacion?.lng ?? null,
        precisionM: ubicacion?.precisionM ?? null,
        createdAt: ahora,
      },
    });

    const firmante = CONFORMIDAD_DE_ETAPA[p.hacia];
    if (firmante) {
      await tx.conformidad.create({
        data: {
          fleteId: p.fleteId,
          rol: firmante,
          userId: p.actor.userId,
          texto: textoConformidad(firmante, resumen),
          aceptadaEn: ahora,
        },
      });
    }
    // La solicitud queda cancelada: el cliente la puede volver a publicar.
    if (p.hacia === "CANCELADO") {
      await tx.solicitud.update({ where: { id: flete.solicitudId }, data: { estado: "CANCELADA" } });
    }

    await emitirEtapa(
      emitir,
      { solicitudId: flete.solicitudId, fleteroId: flete.fleteroId },
      p.hacia,
      resumen,
      p.hacia === "CANCELADO" && p.motivo ? { motivo: p.motivo, por: p.actor.rol } : null,
    );
    publicarDespues([avisoEnVivo(p.fleteId, "etapa")]);
    return { etapa: p.hacia };
  });
}

export async function registrarControl(p: {
  fleteId: string;
  actor: ActorFlete;
  itemId: string;
  fase: FaseControl;
  resultado: ResultadoControl;
  observacion: string | null;
  /** Ya validada contra el bucket por quien llama. */
  foto?: { ruta: string; ancho: number; alto: number } | null;
}): Promise<void> {
  await conEventos(async (tx, { emitir, publicarDespues }) => {
    const flete = await bloquear(tx, p.fleteId, p.actor, "SHARE");
    const item = (await inventario(tx, p.fleteId, flete.solicitudId)).find((i) => i.id === p.itemId);
    if (!item) throw new ActionError("No encontramos ese ítem.");
    const validacion = validarControl({
      etapa: flete.etapa,
      fase: p.fase,
      actor: p.actor.rol,
      resultado: p.resultado,
      observacion: p.observacion,
      item,
    });
    if (!validacion.ok) throw new ActionError(validacion.motivo);

    const control = await tx.controlItem.upsert({
      where: { itemId_fase: { itemId: p.itemId, fase: p.fase } },
      create: {
        itemId: p.itemId,
        fleteId: p.fleteId,
        fase: p.fase,
        resultado: p.resultado,
        observacion: p.observacion,
        autorId: p.actor.userId,
      },
      update: { resultado: p.resultado, observacion: p.observacion, autorId: p.actor.userId },
      select: { id: true },
    });

    if (p.resultado === "RECLAMO") {
      // El reclamo lleva la descripción y la foto; validarControl ya exigió la descripción.
      const reclamo = await tx.reclamo.create({
        data: {
          itemId: p.itemId,
          fleteId: p.fleteId,
          autorId: p.actor.userId,
          descripcion: p.observacion ?? "",
        },
        select: { id: true },
      });
      if (p.foto) await tx.foto.create({ data: { ...p.foto, reclamoId: reclamo.id } });
      await emitir({
        solicitudId: flete.solicitudId,
        fleteroId: flete.fleteroId,
        evento: "RECLAMO_ABIERTO",
        datos: { item: item.nombre.slice(0, 80) },
      });
    } else if (p.foto) {
      await tx.foto.create({ data: { ...p.foto, controlId: control.id } });
    }
    publicarDespues([avisoEnVivo(p.fleteId, "inventario")]);
  });
}

/** "Marcar todo": los ítems pendientes de la fase quedan con el resultado "todo bien". */
export async function marcarTodos(p: {
  fleteId: string;
  actor: ActorFlete;
  fase: FaseControl;
}): Promise<number> {
  return conEventos(async (tx, { publicarDespues }) => {
    const flete = await bloquear(tx, p.fleteId, p.actor, "SHARE");
    const pendientes = pendientesDeFase(await inventario(tx, p.fleteId, flete.solicitudId), p.fase);
    const resultado = RESULTADO_OK[p.fase];
    for (const item of pendientes) {
      const validacion = validarControl({
        etapa: flete.etapa,
        fase: p.fase,
        actor: p.actor.rol,
        resultado,
        observacion: null,
        item,
      });
      if (!validacion.ok) throw new ActionError(validacion.motivo);
    }
    await tx.controlItem.createMany({
      data: pendientes.map((item) => ({
        itemId: item.id,
        fleteId: p.fleteId,
        fase: p.fase,
        resultado,
        autorId: p.actor.userId,
      })),
    });
    publicarDespues([avisoEnVivo(p.fleteId, "inventario")]);
    return pendientes.length;
  });
}

/** Deshace el control de un ítem (un toque de más) mientras se está en esa fase. */
export async function quitarControl(p: {
  fleteId: string;
  actor: ActorFlete;
  itemId: string;
  fase: FaseControl;
}): Promise<void> {
  const rutas = await conEventos(async (tx, { publicarDespues }) => {
    const flete = await bloquear(tx, p.fleteId, p.actor, "SHARE");
    const item = (await inventario(tx, p.fleteId, flete.solicitudId)).find((i) => i.id === p.itemId);
    if (!item) throw new ActionError("No encontramos ese ítem.");
    const validacion = validarQuitarControl({ etapa: flete.etapa, fase: p.fase, actor: p.actor.rol, item });
    if (!validacion.ok) throw new ActionError(validacion.motivo);

    const control = await tx.controlItem.findUnique({
      where: { itemId_fase: { itemId: p.itemId, fase: p.fase } },
      select: { id: true, fotos: { select: { ruta: true } } },
    });
    if (!control) return [];
    // Las fotos del control se borran en cascada; los archivos, después del commit.
    await tx.controlItem.delete({ where: { id: control.id } });
    publicarDespues([avisoEnVivo(p.fleteId, "inventario")]);
    return control.fotos.map((f) => f.ruta);
  });
  await eliminarArchivos(BUCKET_PRIVADO, rutas);
}
