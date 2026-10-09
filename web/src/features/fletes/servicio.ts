import "server-only";
import type { EtapaFlete, FaseControl, ResultadoControl } from "@/domain/catalogos";
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
import { conEventos, type ContextoEventos, type Tx } from "@/features/chat/eventos";
import { BUCKET_PRIVADO, eliminarArchivos } from "@/features/uploads/storage";
import { ActionError, esViolacionUnica } from "@/lib/action";
import { ahoraIso, fallar, nuevoId } from "@/lib/db";
import { aItemControlado } from "./inventario";
import { topicFlete } from "./rutas";
import type { Ubicacion } from "./schemas";

// Única puerta para cambiar un flete: etapas, controles del inventario y reclamos.
// Cada operación vuelve a validar con el dominio (domain/ciclo-flete) y reclama la fila
// con un update condicionado a la etapa leída. Si otra operación ya la cambió, no escribe.
// El mensaje queda en el chat y el aviso en vivo sale si la operación terminó bien.

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

const columnaActor = (actor: ActorFlete) => (actor.rol === "CLIENTE" ? "clienteId" : "fleteroId");

async function leerFlete(tx: Tx, fleteId: string, actor: ActorFlete): Promise<FleteBloqueado> {
  const { data, error } = await tx
    .from("fletes")
    .select("etapa, solicitudId, fleteroId")
    .eq("id", fleteId)
    .eq(columnaActor(actor), actor.perfilId)
    .maybeSingle();
  fallar(error);
  if (!data) throw new ActionError(NO_ENCONTRADO);
  return data as FleteBloqueado;
}

/**
 * Reclama la fila solo si sigue en la etapa que validamos. 0 filas: alguien ya la cambió
 * (o dejó de ser del actor) y se aborta con el mismo error que cuando el flete no está.
 */
async function reclamarEtapa(tx: Tx, fleteId: string, actor: ActorFlete, etapa: EtapaFlete) {
  const { data, error } = await tx
    .from("fletes")
    .update({ updatedAt: ahoraIso() })
    .eq("id", fleteId)
    .eq(columnaActor(actor), actor.perfilId)
    .eq("etapa", etapa)
    .select("id");
  fallar(error);
  if (!data?.length) throw new ActionError(NO_ENCONTRADO);
}

type ItemInventario = ItemControlado & { nombre: string };

interface FilaControl {
  fase: FaseControl;
  resultado: ResultadoControl;
  observacion: string | null;
  fleteId: string;
}

async function inventario(tx: Tx, fleteId: string, solicitudId: string): Promise<ItemInventario[]> {
  const { data, error } = await tx
    .from("items_inventario")
    .select(
      "id, nombre, orden, controles:controles_item!controles_item_itemId_fkey(fase, resultado, observacion, fleteId)",
    )
    .eq("solicitudId", solicitudId)
    .order("orden", { ascending: true });
  fallar(error);
  return (data ?? []).map((i) => {
    const controles = (Array.isArray(i.controles) ? i.controles : i.controles ? [i.controles] : []).filter(
      (c: FilaControl) => c.fleteId === fleteId,
    );
    return { ...aItemControlado(i.id as string, controles), nombre: i.nombre as string };
  });
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
    const flete = await leerFlete(tx, p.fleteId, p.actor);
    const resumen = resumenInventario(await inventario(tx, p.fleteId, flete.solicitudId));
    const validacion = validarTransicion(flete.etapa, p.hacia, p.actor.rol, {
      inventario: resumen,
      conformidad: p.conformidad ?? false,
      motivo: p.motivo ?? null,
    });
    if (!validacion.ok) throw new ActionError(validacion.motivo);

    const ahora = ahoraIso();
    const { data: reclamado, error: errorEtapa } = await tx
      .from("fletes")
      .update({
        etapa: p.hacia,
        updatedAt: ahora,
        ...(p.hacia === "CERRADO" ? { recepcionConfirmadaEn: ahora } : {}),
      })
      .eq("id", p.fleteId)
      .eq(columnaActor(p.actor), p.actor.perfilId)
      .eq("etapa", flete.etapa)
      .select("id");
    fallar(errorEtapa);
    if (!reclamado?.length) throw new ActionError(NO_ENCONTRADO);

    // Solo se guarda la ubicación del fletero: la del cliente no le sirve a nadie.
    const ubicacion = p.actor.rol === "FLETERO" ? p.ubicacion : null;
    const { error: errorHistorial } = await tx.from("estados_flete").insert({
      id: nuevoId(),
      fleteId: p.fleteId,
      etapa: p.hacia,
      autorId: p.actor.userId,
      nota: p.hacia === "CANCELADO" ? (p.motivo ?? null) : null,
      lat: ubicacion?.lat ?? null,
      lng: ubicacion?.lng ?? null,
      precisionM: ubicacion?.precisionM ?? null,
      createdAt: ahora,
    });
    fallar(errorHistorial);

    const firmante = CONFORMIDAD_DE_ETAPA[p.hacia];
    if (firmante) {
      const { error } = await tx.from("conformidades").insert({
        id: nuevoId(),
        fleteId: p.fleteId,
        rol: firmante,
        userId: p.actor.userId,
        texto: textoConformidad(firmante, resumen),
        aceptadaEn: ahora,
      });
      fallar(error);
    }
    // La solicitud queda cancelada: el cliente la puede volver a publicar.
    if (p.hacia === "CANCELADO") {
      const { error } = await tx
        .from("solicitudes")
        .update({ estado: "CANCELADA", updatedAt: ahora })
        .eq("id", flete.solicitudId);
      fallar(error);
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

async function guardarControl(
  tx: Tx,
  p: {
    itemId: string;
    fleteId: string;
    fase: FaseControl;
    resultado: ResultadoControl;
    observacion: string | null;
    autorId: string;
  },
): Promise<string> {
  const ahora = ahoraIso();
  const { data: previo, error: errorPrevio } = await tx
    .from("controles_item")
    .select("id")
    .eq("itemId", p.itemId)
    .eq("fase", p.fase)
    .maybeSingle();
  fallar(errorPrevio);
  const campos = {
    resultado: p.resultado,
    observacion: p.observacion,
    autorId: p.autorId,
    updatedAt: ahora,
  };
  if (previo) {
    const { error } = await tx.from("controles_item").update(campos).eq("id", previo.id as string);
    fallar(error);
    return previo.id as string;
  }
  const id = nuevoId();
  const { error } = await tx.from("controles_item").insert({
    id,
    itemId: p.itemId,
    fleteId: p.fleteId,
    fase: p.fase,
    ...campos,
  });
  if (!esViolacionUnica(error)) {
    fallar(error);
    return id;
  }
  const { error: errorUpdate } = await tx
    .from("controles_item")
    .update(campos)
    .eq("itemId", p.itemId)
    .eq("fase", p.fase);
  fallar(errorUpdate);
  const { data: fila, error: errorFila } = await tx
    .from("controles_item")
    .select("id")
    .eq("itemId", p.itemId)
    .eq("fase", p.fase)
    .single();
  fallar(errorFila);
  if (!fila?.id) throw new Error("No se pudo guardar el control");
  return fila.id as string;
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
    const flete = await leerFlete(tx, p.fleteId, p.actor);
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
    await reclamarEtapa(tx, p.fleteId, p.actor, flete.etapa);

    const controlId = await guardarControl(tx, {
      itemId: p.itemId,
      fleteId: p.fleteId,
      fase: p.fase,
      resultado: p.resultado,
      observacion: p.observacion,
      autorId: p.actor.userId,
    });

    if (p.resultado === "RECLAMO") {
      // El reclamo lleva la descripción y la foto; validarControl ya exigió la descripción.
      const reclamoId = nuevoId();
      const { error } = await tx.from("reclamos").insert({
        id: reclamoId,
        itemId: p.itemId,
        fleteId: p.fleteId,
        autorId: p.actor.userId,
        descripcion: p.observacion ?? "",
      });
      fallar(error);
      if (p.foto) {
        const { error: errorFoto } = await tx.from("fotos").insert({ id: nuevoId(), ...p.foto, reclamoId });
        fallar(errorFoto);
      }
      await emitir({
        solicitudId: flete.solicitudId,
        fleteroId: flete.fleteroId,
        evento: "RECLAMO_ABIERTO",
        datos: { item: item.nombre.slice(0, 80) },
      });
    } else if (p.foto) {
      const { error } = await tx.from("fotos").insert({ id: nuevoId(), ...p.foto, controlId });
      fallar(error);
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
    const flete = await leerFlete(tx, p.fleteId, p.actor);
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
    await reclamarEtapa(tx, p.fleteId, p.actor, flete.etapa);
    if (pendientes.length > 0) {
      const ahora = ahoraIso();
      const { error } = await tx.from("controles_item").insert(
        pendientes.map((item) => ({
          id: nuevoId(),
          itemId: item.id,
          fleteId: p.fleteId,
          fase: p.fase,
          resultado,
          autorId: p.actor.userId,
          updatedAt: ahora,
        })),
      );
      fallar(error);
    }
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
    const flete = await leerFlete(tx, p.fleteId, p.actor);
    const item = (await inventario(tx, p.fleteId, flete.solicitudId)).find((i) => i.id === p.itemId);
    if (!item) throw new ActionError("No encontramos ese ítem.");
    const validacion = validarQuitarControl({ etapa: flete.etapa, fase: p.fase, actor: p.actor.rol, item });
    if (!validacion.ok) throw new ActionError(validacion.motivo);
    await reclamarEtapa(tx, p.fleteId, p.actor, flete.etapa);

    const { data, error } = await tx
      .from("controles_item")
      .select("id, fotos:fotos!fotos_controlId_fkey(ruta)")
      .eq("itemId", p.itemId)
      .eq("fase", p.fase)
      .maybeSingle();
    fallar(error);
    if (!data) return [];
    const { error: errorBorrado } = await tx.from("controles_item").delete().eq("id", data.id as string);
    fallar(errorBorrado);
    publicarDespues([avisoEnVivo(p.fleteId, "inventario")]);
    const fotos = Array.isArray(data.fotos) ? data.fotos : data.fotos ? [data.fotos] : [];
    return fotos.map((f) => (f as { ruta: string }).ruta);
  });
  await eliminarArchivos(BUCKET_PRIVADO, rutas);
}
