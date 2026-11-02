/**
 * Datos de demo del Gran San Miguel de Tucumán.
 *
 * Es determinista: siempre crea los mismos usuarios, fleteros y solicitudes. Las fechas son
 * relativas al día en que se corre, así la demo siempre tiene solicitudes abiertas a futuro
 * y fletes en curso hoy. BORRA TODOS LOS DATOS antes de cargar; no corre en producción.
 *
 * Las tarifas son valores de referencia para la demo, no precios de mercado relevados.
 */
import { createClient } from "@supabase/supabase-js";
import bcrypt from "bcryptjs";
import type { EtapaFlete, FranjaHoraria, TipoFlete, TipoVehiculo } from "../src/domain/catalogos";
import { actualizar, contar, filas, insertar, insertarVarios, vaciar } from "../src/lib/filas";
import { resumirCarga, type ItemCarga } from "../src/domain/carga";
import { haversineKm, redondear, type Coordenadas } from "../src/domain/geo";
import { precioSugerido, type Tarifas } from "../src/domain/precio";
import { FRANJA } from "../src/domain/catalogos";
import { fechaIsoDeDia } from "../src/domain/fechas";
import { resumenInventario, textoConformidad } from "../src/domain/ciclo-flete";
import type { DatosEvento, EventoChat } from "../src/features/chat/eventos-catalogo";
import { aItemControlado } from "../src/features/fletes/inventario";

if (process.env.NODE_ENV === "production") {
  console.error("El seed borra todos los datos: no se ejecuta con NODE_ENV=production.");
  process.exit(1);
}

const urlSupabase = process.env.SUPABASE_URL ?? "";
if (!/localhost|127\.0\.0\.1/.test(urlSupabase)) {
  console.error("El seed solo corre contra una base local de prueba.");
  process.exit(1);
}

const sb = createClient(urlSupabase, process.env.SUPABASE_SERVICE_ROLE_KEY ?? "", {
  auth: { persistSession: false, autoRefreshToken: false },
});

const PASSWORD_DEMO = "Demo1234";
const HORA = 60 * 60 * 1000;
const DIA = 24 * HORA;

/** Hoy en Tucumán (UTC−3), como fecha sin hora para columnas `@db.Date`. */
function dia(offset: number): Date {
  const ahoraAr = new Date(Date.now() - 3 * HORA);
  return new Date(Date.UTC(ahoraAr.getUTCFullYear(), ahoraAr.getUTCMonth(), ahoraAr.getUTCDate() + offset));
}
const hace = (dias: number, horas = 0) => new Date(Date.now() - dias * DIA - horas * HORA);

// ---------------------------------------------------------------------------
// Lugares (coordenadas aproximadas de cada barrio o localidad)
// ---------------------------------------------------------------------------

interface Lugar extends Coordenadas {
  direccion: string;
}

const LUGARES = {
  centro: { direccion: "24 de Septiembre 550, San Miguel de Tucumán", lat: -26.8303, lng: -65.2038 },
  barrioNorte: {
    direccion: "Av. Salta 650, Barrio Norte, San Miguel de Tucumán",
    lat: -26.8185,
    lng: -65.2105,
  },
  barrioSur: { direccion: "Av. Roca 420, Barrio Sur, San Miguel de Tucumán", lat: -26.8405, lng: -65.2062 },
  ciudadela: {
    direccion: "Av. Mate de Luna 2400, Ciudadela, San Miguel de Tucumán",
    lat: -26.8235,
    lng: -65.229,
  },
  parque: {
    direccion: "Av. Soldati 300, Parque 9 de Julio, San Miguel de Tucumán",
    lat: -26.832,
    lng: -65.189,
  },
  villaLujan: {
    direccion: "Pasaje Padilla 1100, Villa Luján, San Miguel de Tucumán",
    lat: -26.815,
    lng: -65.195,
  },
  abasto: { direccion: "Mercado de Abasto, San Miguel de Tucumán", lat: -26.8465, lng: -65.2291 },
  yerbaBuena: { direccion: "Av. Aconquija 1200, Yerba Buena", lat: -26.8163, lng: -65.2851 },
  villaCarmela: { direccion: "Villa Carmela, Yerba Buena", lat: -26.796, lng: -65.287 },
  elManantial: { direccion: "Ruta 338, El Manantial", lat: -26.849, lng: -65.28 },
  tafiViejo: { direccion: "Av. Sáenz Peña 300, Tafí Viejo", lat: -26.7322, lng: -65.2594 },
  lasTalitas: { direccion: "Av. Juan B. Justo 2800, Las Talitas", lat: -26.77, lng: -65.205 },
  banda: { direccion: "Av. Independencia 1000, Banda del Río Salí", lat: -26.8433, lng: -65.1667 },
  alderetes: { direccion: "Av. Lavaisse 500, Alderetes", lat: -26.8167, lng: -65.1333 },
  lules: { direccion: "Av. 9 de Julio 400, San Isidro de Lules", lat: -26.925, lng: -65.335 },
} satisfies Record<string, Lugar>;

// ---------------------------------------------------------------------------
// Fábricas
// ---------------------------------------------------------------------------

let passwordHash = "";

/** Toma solo los campos de User: un spread del objeto del fletero colaría dni, bio, etc. */
function datosUsuario({
  nombre,
  apellido,
  email,
  telefono,
}: {
  nombre: string;
  apellido: string;
  email: string;
  telefono: string;
}) {
  return { nombre, apellido, telefono, passwordHash, email: email.toLowerCase() };
}

async function crearCliente(nombre: string, apellido: string, email: string, telefono: string, lugar: Lugar) {
  const user = await insertar<{ id: string }>(sb, "usuarios", {
    ...datosUsuario({ nombre, apellido, email, telefono }),
    rol: "CLIENTE",
    createdAt: hace(90),
  });
  const perfil = await insertar<{ id: string }>(sb, "perfiles_cliente", {
    userId: user.id,
    direccionHabitual: lugar.direccion,
    lat: lugar.lat,
    lng: lugar.lng,
  });
  return { userId: user.id, clienteId: perfil.id };
}

interface VehiculoSeed {
  tipo: TipoVehiculo;
  marca: string;
  modelo: string;
  anio: number;
  patente: string;
  capacidadKg: number;
  volumenM3: number;
}

interface FleteroSeed {
  nombre: string;
  apellido: string;
  email: string;
  telefono: string;
  dni: string;
  bio: string;
  base: Lugar;
  radioCoberturaKm: number;
  tarifas: Tarifas;
  vehiculos: VehiculoSeed[];
  disponible?: boolean;
  verificado?: boolean;
}

async function crearFletero(f: FleteroSeed) {
  const user = await insertar<{ id: string }>(sb, "usuarios", {
    ...datosUsuario(f),
    rol: "FLETERO",
    createdAt: hace(120),
  });
  const perfil = await insertar<{ id: string }>(sb, "perfiles_fletero", {
    userId: user.id,
    dni: f.dni,
    bio: f.bio,
    baseDireccion: f.base.direccion,
    baseLat: f.base.lat,
    baseLng: f.base.lng,
    radioCoberturaKm: f.radioCoberturaKm,
    ...f.tarifas,
    disponible: f.disponible ?? true,
    verificado: f.verificado ?? true,
    onboardingCompletadoEn: hace(118),
  });
  const vehiculos = [];
  for (const v of f.vehiculos) vehiculos.push(await insertar<{ id: string; capacidadKg: number }>(sb, "vehiculos", { fleteroId: perfil.id, ...v }));
  vehiculos.sort((a, b) => b.capacidadKg - a.capacidadKg);
  return { userId: user.id, fleteroId: perfil.id, vehiculoId: vehiculos[0]!.id, tarifas: f.tarifas };
}

type Fletero = Awaited<ReturnType<typeof crearFletero>>;
type Cliente = Awaited<ReturnType<typeof crearCliente>>;

interface ItemSeed extends ItemCarga {
  nombre: string;
  fragil?: boolean;
  notas?: string;
}

const item = (
  nombre: string,
  cantidad: number,
  medidas?: [largo: number, ancho: number, alto: number],
  pesoKgAprox?: number,
  fragil = false,
): ItemSeed => ({
  nombre,
  cantidad,
  largoCm: medidas?.[0] ?? null,
  anchoCm: medidas?.[1] ?? null,
  altoCm: medidas?.[2] ?? null,
  pesoKgAprox: pesoKgAprox ?? null,
  fragil,
});

interface SolicitudSeed {
  cliente: Cliente;
  tipoFlete: TipoFlete;
  titulo: string;
  descripcion?: string;
  origen: Lugar;
  destino: Lugar;
  origenPiso?: number;
  destinoPiso?: number;
  origenAscensor?: boolean;
  destinoAscensor?: boolean;
  fecha: Date;
  franja: FranjaHoraria;
  tipoVehiculoSugerido?: TipoVehiculo;
  ayudantesRequeridos?: number;
  requiereEmbalaje?: boolean;
  items: ItemSeed[];
  creadaHaceDias: number;
}

async function crearSolicitud(
  s: SolicitudSeed,
  estado: "ABIERTA" | "ADJUDICADA" | "CANCELADA" | "VENCIDA" = "ABIERTA",
) {
  const carga = resumirCarga(s.items);
  const distanciaKm = redondear(haversineKm(s.origen, s.destino), 2);
  const solicitud = await insertar<{ id: string }>(sb, "solicitudes", {
    clienteId: s.cliente.clienteId,
    tipoFlete: s.tipoFlete,
    titulo: s.titulo,
    descripcion: s.descripcion ?? null,
    origenDireccion: s.origen.direccion,
    origenLat: s.origen.lat,
    origenLng: s.origen.lng,
    origenPiso: s.origenPiso ?? null,
    origenAscensor: s.origenAscensor ?? false,
    destinoDireccion: s.destino.direccion,
    destinoLat: s.destino.lat,
    destinoLng: s.destino.lng,
    destinoPiso: s.destinoPiso ?? null,
    destinoAscensor: s.destinoAscensor ?? false,
    distanciaKm,
    pesoTotalKg: carga.pesoTotalKg,
    volumenTotalM3: carga.volumenTotalM3,
    itemsSinMedidas: carga.itemsSinMedidas,
    fecha: s.fecha,
    franja: s.franja,
    tipoVehiculoSugerido: s.tipoVehiculoSugerido ?? null,
    ayudantesRequeridos: s.ayudantesRequeridos ?? 0,
    // Las mudanzas de la demo piden embalaje: así se ve el extra en el feed y en los presupuestos.
    requiereEmbalaje: s.requiereEmbalaje ?? s.tipoFlete === "MUDANZA",
    estado,
    createdAt: hace(s.creadaHaceDias),
  });
  await insertarVarios(
    sb,
    "items_inventario",
    s.items.map(({ nombre, cantidad, largoCm, anchoCm, altoCm, pesoKgAprox, fragil, notas }, orden) => ({
      solicitudId: solicitud.id,
      nombre,
      cantidad,
      largoCm: largoCm ?? null,
      anchoCm: anchoCm ?? null,
      altoCm: altoCm ?? null,
      pesoKgAprox: pesoKgAprox ?? null,
      fragil: fragil ?? false,
      notas: notas ?? null,
      orden,
    })),
  );
  return { ...solicitud, seed: s, distanciaKm, volumenTotalM3: carga.volumenTotalM3 };
}

type Solicitud = Awaited<ReturnType<typeof crearSolicitud>>;

async function presupuestar(
  solicitud: Solicitud,
  fletero: Fletero,
  opciones: {
    ajuste?: number;
    mensaje?: string;
    estado?: "PENDIENTE" | "ACEPTADO" | "RECHAZADO" | "RETIRADO";
    vehiculoId?: string;
  } = {},
) {
  const ayudantes = solicitud.seed.ayudantesRequeridos ?? 0;
  const sugerido = precioSugerido(
    { distanciaLinealKm: solicitud.distanciaKm, volumenM3: solicitud.volumenTotalM3, ayudantes },
    fletero.tarifas,
  );
  const monto = Math.max(1_000, sugerido + (opciones.ajuste ?? 0));
  const creado = hace(solicitud.seed.creadaHaceDias - 0.5);
  const estado = opciones.estado ?? "PENDIENTE";
  // Los pendientes siguen vigentes; el resto venció hace rato.
  const validoHasta =
    estado === "PENDIENTE" ? new Date(Date.now() + 2 * DIA) : new Date(creado.getTime() + 2 * DIA);
  // Hora de llegada dentro de la franja pedida (la flexible no la fija).
  const desde = FRANJA[solicitud.seed.franja].desde;
  const horaLlegada =
    solicitud.seed.franja === "FLEXIBLE" ? null : `${String(desde + 1).padStart(2, "0")}:00`;
  const presupuesto = await insertar<{ id: string }>(sb, "presupuestos", {
    horaLlegada,
    solicitudId: solicitud.id,
    fleteroId: fletero.fleteroId,
    vehiculoId: opciones.vehiculoId ?? fletero.vehiculoId,
    monto,
    montoSugerido: sugerido,
    incluyeAyudantes: ayudantes,
    mensaje: opciones.mensaje ?? null,
    validoHasta,
    estado,
    createdAt: creado,
  });

  // Igual que en la app: presupuestar abre el chat con el aviso del sistema y el mensaje del fletero.
  const conversacionId = await conversacionDe(solicitud, fletero, creado);
  await mensajeSistema(
    conversacionId,
    "PRESUPUESTO_ENVIADO",
    { monto, validoHasta: validoHasta.toISOString() },
    creado,
  );
  if (opciones.mensaje)
    await mensajeTexto(conversacionId, fletero.userId, opciones.mensaje, minutosDespues(creado, 1));
  if (estado === "RETIRADO")
    await mensajeSistema(conversacionId, "PRESUPUESTO_RETIRADO", {}, minutosDespues(creado, 90));
  return { id: presupuesto.id, monto, conversacionId };
}

// ---------------------------------------------------------------------------
// Chat
// ---------------------------------------------------------------------------

const minutosDespues = (instante: Date, minutos: number) =>
  new Date(instante.getTime() + minutos * 60 * 1000);

async function conversacionDe(solicitud: Solicitud, fletero: Fletero, creada: Date): Promise<string> {
  const existente = (
    await filas<{ id: string }>(sb, "conversaciones", { solicitudId: solicitud.id, fleteroId: fletero.fleteroId })
  )[0];
  if (existente) return existente.id;
  const conversacion = await insertar<{ id: string }>(sb, "conversaciones", {
    solicitudId: solicitud.id,
    fleteroId: fletero.fleteroId,
    clienteId: solicitud.seed.cliente.clienteId,
    createdAt: creada,
  });
  return conversacion.id;
}

async function mensajeSistema<E extends EventoChat>(
  conversacionId: string,
  evento: E,
  datos: DatosEvento<E>,
  en: Date,
) {
  await insertar(sb, "mensajes", { conversacionId, tipo: "SISTEMA", evento, datos, createdAt: en });
}

async function mensajeTexto(conversacionId: string, autorId: string, contenido: string, en: Date) {
  await insertar(sb, "mensajes", { conversacionId, autorId, contenido, createdAt: en });
}

const ORDEN_ETAPAS: EtapaFlete[] = [
  "CONFIRMADO",
  "EN_CAMINO_A_ORIGEN",
  "CARGANDO",
  "EN_TRASLADO",
  "DESCARGANDO",
  "ENTREGADO",
  "CERRADO",
];
const ETAPAS_DEL_CLIENTE: EtapaFlete[] = ["CONFIRMADO", "CERRADO", "CANCELADO"];

/** Dónde estaba el fletero al llegar a cada etapa (lo que compartiría su navegador). */
function ubicacionDe(etapa: EtapaFlete, s: SolicitudSeed) {
  const cerca = (l: Coordenadas, delta: number) => ({
    lat: l.lat + delta,
    lng: l.lng - delta,
    precisionM: 25,
  });
  switch (etapa) {
    case "EN_CAMINO_A_ORIGEN":
      return cerca(s.origen, 0.02);
    case "CARGANDO":
    case "EN_TRASLADO":
      return cerca(s.origen, 0.0004);
    case "DESCARGANDO":
    case "ENTREGADO":
      return cerca(s.destino, 0.0004);
    default:
      return null;
  }
}

/**
 * Acepta un presupuesto, rechaza el resto y arma el flete con su historial hasta `etapa`, con el
 * inventario controlado de forma coherente (a medias si está cargando o descargando ahora).
 * `incidencias`: observación al cargar el 1.er ítem, daño al descargar el 2.º y reclamo del cliente.
 */
async function adjudicar(
  solicitud: Solicitud,
  fletero: Fletero,
  etapa: EtapaFlete,
  opciones: {
    ajuste?: number;
    mensaje?: string;
    competidores?: Fletero[];
    notaCancelacion?: string;
    incidencias?: boolean;
  } = {},
) {
  const perdedores: string[] = [];
  for (const competidor of opciones.competidores ?? []) {
    perdedores.push(
      (await presupuestar(solicitud, competidor, { ajuste: 3_000, estado: "RECHAZADO" })).conversacionId,
    );
  }
  const ganador = await presupuestar(solicitud, fletero, {
    estado: "ACEPTADO",
    ...(opciones.ajuste !== undefined ? { ajuste: opciones.ajuste } : {}),
    ...(opciones.mensaje !== undefined ? { mensaje: opciones.mensaje } : {}),
  });

  const { cliente, creadaHaceDias } = solicitud.seed;
  const cancelado = etapa === "CANCELADO";
  const alcanzadas: EtapaFlete[] = cancelado
    ? ["CONFIRMADO"]
    : ORDEN_ETAPAS.slice(0, ORDEN_ETAPAS.indexOf(etapa) + 1);
  const llego = (e: EtapaFlete) => alcanzadas.includes(e);
  const confirmadoHace = creadaHaceDias - 1;

  const historial = alcanzadas.map((e, i) => {
    const ubicacion = ubicacionDe(e, solicitud.seed);
    return {
      etapa: e,
      autorId: ETAPAS_DEL_CLIENTE.includes(e) ? cliente.userId : fletero.userId,
      createdAt: hace(Math.max(confirmadoHace - i * 0.04, 0), 2 - i * 0.25),
      lat: ubicacion?.lat ?? null,
      lng: ubicacion?.lng ?? null,
      precisionM: ubicacion?.precisionM ?? null,
      nota: null as string | null,
    };
  });
  if (cancelado) {
    historial.push({
      etapa: "CANCELADO",
      autorId: cliente.userId,
      createdAt: hace(Math.max(confirmadoHace - 0.5, 0)),
      lat: null,
      lng: null,
      precisionM: null,
      nota: opciones.notaCancelacion ?? null,
    });
  }
  const en = (e: EtapaFlete) => historial.find((h) => h.etapa === e)!.createdAt;

  const flete = await insertar<{ id: string }>(sb, "fletes", {
    solicitudId: solicitud.id,
    presupuestoId: ganador.id,
    clienteId: cliente.clienteId,
    fleteroId: fletero.fleteroId,
    vehiculoId: fletero.vehiculoId,
    precioAcordado: ganador.monto,
    etapa,
    recepcionConfirmadaEn: etapa === "CERRADO" ? en("CERRADO") : null,
    createdAt: hace(confirmadoHace),
  });
  await insertarVarios(
    sb,
    "estados_flete",
    historial.map((h) => ({ ...h, fleteId: flete.id })),
  );

  // Inventario controlado según la etapa.
  const items = await filas<{ id: string; nombre: string }>(
    sb,
    "items_inventario",
    { solicitudId: solicitud.id },
    { columna: "orden" },
  );
  const controles: {
    itemId: string;
    fleteId: string;
    fase: "CARGA" | "DESCARGA" | "RECEPCION";
    resultado: "CARGADO" | "NO_CARGADO" | "ENTREGADO" | "CON_DANO" | "FALTANTE" | "CONFORME" | "RECLAMO";
    autorId: string;
    observacion: string | null;
    createdAt: Date;
    updatedAt: Date;
  }[] = [];
  const control = (
    itemId: string,
    fase: "CARGA" | "DESCARGA" | "RECEPCION",
    resultado: (typeof controles)[number]["resultado"],
    autorId: string,
    momento: Date,
    observacion: string | null = null,
  ) =>
    controles.push({
      itemId,
      fleteId: flete.id,
      fase,
      resultado,
      autorId,
      observacion,
      createdAt: momento,
      updatedAt: momento,
    });
  const incidencia = (i: number, cual: number) => Boolean(opciones.incidencias) && i === cual;

  if (llego("CARGANDO")) {
    const cuantos = llego("EN_TRASLADO") ? items.length : Math.ceil(items.length / 2);
    items
      .slice(0, cuantos)
      .forEach((it, i) =>
        control(
          it.id,
          "CARGA",
          "CARGADO",
          fletero.userId,
          minutosDespues(en("CARGANDO"), 5 + i * 4),
          incidencia(i, 0) ? "Rayón previo en un lateral." : null,
        ),
      );
  }
  if (llego("DESCARGANDO")) {
    const cuantos = llego("ENTREGADO") ? items.length : Math.floor(items.length / 2);
    items
      .slice(0, cuantos)
      .forEach((it, i) =>
        control(
          it.id,
          "DESCARGA",
          incidencia(i, 1) ? "CON_DANO" : "ENTREGADO",
          fletero.userId,
          minutosDespues(en("DESCARGANDO"), 5 + i * 4),
          incidencia(i, 1) ? "Se golpeó en el viaje: una esquina abollada." : null,
        ),
      );
  }
  if (llego("CERRADO")) {
    items.forEach((it, i) =>
      control(
        it.id,
        "RECEPCION",
        incidencia(i, 1) ? "RECLAMO" : "CONFORME",
        cliente.userId,
        minutosDespues(en("CERRADO"), -10 + i),
        incidencia(i, 1) ? "Llegó golpeada y con parte del contenido roto." : null,
      ),
    );
  }
  await insertarVarios(sb, "controles_item", controles);
  const reclamado = opciones.incidencias && llego("CERRADO") ? items[1] : undefined;
  if (reclamado) {
    await insertar(sb, "reclamos", {
      itemId: reclamado.id,
      fleteId: flete.id,
      autorId: cliente.userId,
      descripcion: "Llegó golpeada y con parte del contenido roto.",
      createdAt: minutosDespues(en("CERRADO"), -9),
    });
  }

  const resumen = resumenInventario(
    items.map((it) =>
      aItemControlado(
        it.id,
        controles
          .filter((c) => c.itemId === it.id)
          .map((c) => ({ fase: c.fase, resultado: c.resultado, observacion: c.observacion ?? null })),
      ),
    ),
  );
  if (llego("ENTREGADO")) {
    await insertar(sb, "conformidades", {
      fleteId: flete.id,
      rol: "FLETERO",
      userId: fletero.userId,
      texto: textoConformidad("FLETERO", resumen),
      aceptadaEn: en("ENTREGADO"),
    });
  }
  if (llego("CERRADO")) {
    await insertar(sb, "conformidades", {
      fleteId: flete.id,
      rol: "CLIENTE",
      userId: cliente.userId,
      texto: textoConformidad("CLIENTE", resumen),
      aceptadaEn: en("CERRADO"),
    });
  }

  // Mensajes de sistema de cada etapa, como los deja la app.
  const c = ganador.conversacionId;
  for (const h of historial) {
    switch (h.etapa) {
      case "CONFIRMADO": {
        const { fecha, franja } = solicitud.seed;
        await mensajeSistema(
          c,
          "FLETE_CONFIRMADO",
          { monto: ganador.monto, fecha: fechaIsoDeDia(fecha), franja },
          h.createdAt,
        );
        break;
      }
      case "EN_CAMINO_A_ORIGEN":
        await mensajeSistema(c, "EN_CAMINO_A_ORIGEN", {}, h.createdAt);
        break;
      case "CARGANDO":
        await mensajeSistema(c, "LLEGADA_ORIGEN", {}, h.createdAt);
        break;
      case "EN_TRASLADO":
        await mensajeSistema(
          c,
          "CARGA_REGISTRADA",
          {
            cargados: resumen.cargados,
            noCargados: resumen.noCargados,
            conObservacion: resumen.conObservacionAlCargar,
          },
          h.createdAt,
        );
        break;
      case "DESCARGANDO":
        await mensajeSistema(c, "LLEGADA_DESTINO", {}, h.createdAt);
        break;
      case "ENTREGADO":
        await mensajeSistema(
          c,
          "DESCARGA_REGISTRADA",
          { entregados: resumen.entregados, conDano: resumen.conDano, faltantes: resumen.faltantes },
          h.createdAt,
        );
        break;
      case "CERRADO":
        if (reclamado) {
          await mensajeSistema(
            c,
            "RECLAMO_ABIERTO",
            { item: reclamado.nombre },
            minutosDespues(h.createdAt, -9),
          );
        }
        await mensajeSistema(c, "FLETE_CERRADO", { reclamos: resumen.reclamos }, h.createdAt);
        break;
      case "CANCELADO":
        await mensajeSistema(
          c,
          "FLETE_CANCELADO",
          { motivo: opciones.notaCancelacion ?? "Sin motivo", por: "CLIENTE" },
          h.createdAt,
        );
        break;
    }
  }
  const confirmadoEn = historial[0]!.createdAt;
  for (const conversacionId of perdedores) {
    await mensajeSistema(conversacionId, "PRESUPUESTO_NO_ELEGIDO", {}, confirmadoEn);
  }

  return { fleteId: flete.id, cliente, fletero, conversacionId: ganador.conversacionId };
}

async function calificar(
  adjudicado: Awaited<ReturnType<typeof adjudicar>>,
  puntaje: number,
  comentario: string,
  haceDias: number,
) {
  await insertar(sb, "calificaciones", {
    fleteId: adjudicado.fleteId,
    clienteId: adjudicado.cliente.clienteId,
    fleteroId: adjudicado.fletero.fleteroId,
    puntaje,
    comentario,
    createdAt: hace(haceDias),
  });
}

/** Agrega mensajes de texto a la conversación del par (ya creada al presupuestar). */
async function conversar(
  solicitud: Solicitud,
  fletero: Fletero,
  mensajes: [autor: "cliente" | "fletero", texto: string][],
) {
  const inicio = hace(solicitud.seed.creadaHaceDias - 0.6);
  const conversacionId = await conversacionDe(solicitud, fletero, inicio);
  for (const [i, [autor, contenido]] of mensajes.entries()) {
    const autorId = autor === "cliente" ? solicitud.seed.cliente.userId : fletero.userId;
    await mensajeTexto(conversacionId, autorId, contenido, minutosDespues(inicio, i * 25));
  }
  return conversacionId;
}

/** Última actividad = último mensaje; todo leído salvo lo que se deja pendiente para la demo. */
async function ajustarLecturas() {
  const mensajes = await filas<{ conversacionId: string; createdAt: string }>(sb, "mensajes");
  const ultimo = new Map<string, string>();
  for (const m of mensajes) {
    const previo = ultimo.get(m.conversacionId);
    if (!previo || m.createdAt > previo) ultimo.set(m.conversacionId, m.createdAt);
  }
  for (const [id, en] of ultimo) {
    await actualizar(sb, "conversaciones", { id }, { ultimaActividadEn: en, leidoHastaCliente: en, leidoHastaFletero: en });
  }
}

async function notificacion(
  userId: string,
  tipo: "MENSAJE" | "PRESUPUESTO" | "FLETE" | "PROPUESTA",
  titulo: string,
  href: string,
  cuerpo: string,
  clave?: string,
) {
  await insertar(sb, "notificaciones", { userId, tipo, titulo, href, cuerpo, ...(clave ? { clave } : {}) });
}

// ---------------------------------------------------------------------------
// Carga
// ---------------------------------------------------------------------------

async function limpiar() {
  const tablas: [string, string][] = [
    ["limites_tasa", "clave"],
    ["tokens_recuperacion", "id"],
    ["subidas_pendientes", "ruta"],
    ["notificaciones", "id"],
    ["calificaciones", "id"],
    ["conformidades", "id"],
    ["reclamos", "id"],
    ["controles_item", "id"],
    ["estados_flete", "id"],
    ["propuestas_horario", "id"],
    ["mensajes", "id"],
    ["conversaciones", "id"],
    ["fletes", "id"],
    ["presupuestos", "id"],
    ["fotos", "id"],
    ["items_inventario", "id"],
    ["solicitudes", "id"],
    ["vehiculos", "id"],
    ["perfiles_fletero", "id"],
    ["perfiles_cliente", "id"],
    ["usuarios", "id"],
  ];
  for (const [tabla, columna] of tablas) await vaciar(sb, tabla, columna);
}

/** Recalcula el rating desnormalizado, igual que lo hará la Server Action de calificar. */
async function recalcularRatings() {
  const calificaciones = await filas<{ fleteroId: string; puntaje: number }>(sb, "calificaciones");
  const porFletero = new Map<string, number[]>();
  for (const c of calificaciones) {
    const lista = porFletero.get(c.fleteroId) ?? [];
    lista.push(c.puntaje);
    porFletero.set(c.fleteroId, lista);
  }
  for (const [fleteroId, puntajes] of porFletero) {
    const promedio = puntajes.reduce((suma, p) => suma + p, 0) / puntajes.length;
    await actualizar(sb, "perfiles_fletero", { id: fleteroId }, {
      ratingPromedio: redondear(promedio, 2),
      cantidadCalificaciones: puntajes.length,
    });
  }
}

async function main() {
  passwordHash = await bcrypt.hash(PASSWORD_DEMO, 10);
  await limpiar();

  // --- Admin ---
  await insertar(sb, "usuarios", {
    ...datosUsuario({
      nombre: "Equipo",
      apellido: "Fletes Tucumán",
      email: "admin@demo.test",
      telefono: "3814000000",
    }),
    rol: "ADMIN",
  });

  // --- Clientes ---
  const ana = await crearCliente("Ana", "Pereyra", "ana@demo.test", "3814112222", LUGARES.barrioSur);
  const luis = await crearCliente("Luis", "Gómez", "luis@demo.test", "3814334444", LUGARES.centro);
  const valeria = await crearCliente(
    "Valeria",
    "Sosa",
    "valeria@demo.test",
    "3815127788",
    LUGARES.yerbaBuena,
  );
  const martin = await crearCliente(
    "Martín",
    "Albornoz",
    "martin@demo.test",
    "3816540012",
    LUGARES.ciudadela,
  );
  const carolina = await crearCliente(
    "Carolina",
    "Núñez",
    "carolina@demo.test",
    "3814998123",
    LUGARES.tafiViejo,
  );
  const jorge = await crearCliente("Jorge", "Robles", "jorge@demo.test", "3815773300", LUGARES.banda);
  const florencia = await crearCliente(
    "Florencia",
    "Lazarte",
    "florencia@demo.test",
    "3816221409",
    LUGARES.barrioNorte,
  );
  const sebastian = await crearCliente(
    "Sebastián",
    "Toledo",
    "sebastian@demo.test",
    "3814701566",
    LUGARES.villaCarmela,
  );

  // Clienta recién registrada, sin dirección habitual: el buscador le pide que la cargue y
  // muestra a los fleteros sin distancia.
  const paula = await insertar<{ id: string }>(sb, "usuarios", {
    ...datosUsuario({ nombre: "Paula", apellido: "Ibarra", email: "paula@demo.test", telefono: "" }),
    rol: "CLIENTE",
  });
  await insertar(sb, "perfiles_cliente", { userId: paula.id });
  // Cuenta para mostrar "cambiar contraseña" y "¿Olvidaste tu contraseña?" en la defensa sin
  // cerrar las sesiones de las cuentas del recorrido principal.
  await crearCliente("Rocío", "Medina", "rocio@demo.test", "3816009988", LUGARES.parque);

  // --- Fleteros: todos los tipos de vehículo, repartidos por el Gran Tucumán ---
  const T = (
    precioMinimo: number,
    precioPorKm: number,
    precioPorM3: number,
    precioPorAyudante: number,
  ): Tarifas => ({
    precioMinimo,
    precioPorKm,
    precioPorM3,
    precioPorAyudante,
  });

  const carlos = await crearFletero({
    nombre: "Carlos",
    apellido: "Rodríguez",
    email: "carlos@demo.test",
    telefono: "3815000001",
    dni: "28456123",
    bio: "Fletes y mudanzas chicas en toda la capital. Llevo mantas, sogas y zorra para electrodomésticos.",
    base: LUGARES.barrioNorte,
    radioCoberturaKm: 20,
    tarifas: T(25_000, 1_800, 4_000, 15_000),
    vehiculos: [
      {
        tipo: "CAMIONETA",
        marca: "Toyota",
        modelo: "Hilux con jaula",
        anio: 2019,
        patente: "AD234KL",
        capacidadKg: 1_000,
        volumenM3: 3.5,
      },
    ],
  });
  const marta = await crearFletero({
    nombre: "Marta",
    apellido: "Silva",
    email: "marta@demo.test",
    telefono: "3815000002",
    dni: "33781902",
    bio: "Envíos de paquetes, trámites y compras chicas en el día, dentro de la capital.",
    base: LUGARES.centro,
    radioCoberturaKm: 10,
    tarifas: T(4_000, 600, 0, 0),
    vehiculos: [
      {
        tipo: "MOTO",
        marca: "Honda",
        modelo: "Wave 110 con baúl",
        anio: 2022,
        patente: "A123BCD",
        capacidadKg: 25,
        volumenM3: 0.08,
      },
    ],
  });
  const jose = await crearFletero({
    nombre: "José",
    apellido: "Fernández",
    email: "jose@demo.test",
    telefono: "3815000003",
    dni: "22109874",
    bio: "Mudanzas completas con ayudantes y embalaje. Trabajo en todo el Gran Tucumán.",
    base: LUGARES.banda,
    radioCoberturaKm: 40,
    tarifas: T(90_000, 3_500, 6_000, 18_000),
    vehiculos: [
      {
        tipo: "CAMION",
        marca: "Mercedes-Benz",
        modelo: "Accelo 1016 furgón",
        anio: 2017,
        patente: "AF567GH",
        capacidadKg: 5_000,
        volumenM3: 25,
      },
      {
        tipo: "CAMIONETA",
        marca: "Ford",
        modelo: "Ranger",
        anio: 2016,
        patente: "AA902TR",
        capacidadKg: 1_000,
        volumenM3: 2.5,
      },
    ],
  });
  const soledad = await crearFletero({
    nombre: "Soledad",
    apellido: "Castro",
    email: "soledad@demo.test",
    telefono: "3815000004",
    dni: "35220417",
    bio: "Traslado de muebles chicos, compras grandes y electrodomésticos. Zona Yerba Buena y capital.",
    base: LUGARES.yerbaBuena,
    radioCoberturaKm: 15,
    tarifas: T(12_000, 1_200, 3_000, 15_000),
    vehiculos: [
      {
        tipo: "AUTO",
        marca: "Renault",
        modelo: "Kangoo furgón",
        anio: 2020,
        patente: "AE890PL",
        capacidadKg: 600,
        volumenM3: 3,
      },
    ],
  });
  const ramon = await crearFletero({
    nombre: "Ramón",
    apellido: "Díaz",
    email: "ramon@demo.test",
    telefono: "3815000005",
    dni: "25330981",
    bio: "Fletes desde Tafí Viejo y Las Talitas hacia la capital. Horario corrido.",
    base: LUGARES.tafiViejo,
    radioCoberturaKm: 25,
    tarifas: T(22_000, 1_700, 3_500, 14_000),
    vehiculos: [
      {
        tipo: "CAMIONETA",
        marca: "Volkswagen",
        modelo: "Amarok",
        anio: 2018,
        patente: "AC321ZX",
        capacidadKg: 1_000,
        volumenM3: 3.2,
      },
    ],
  });
  const gustavo = await crearFletero({
    nombre: "Gustavo",
    apellido: "Herrera",
    email: "gustavo@demo.test",
    telefono: "3815000006",
    dni: "27654018",
    bio: "Mudanzas medianas y traslados para comercios. Furgón cerrado, carga protegida de la lluvia.",
    base: LUGARES.ciudadela,
    radioCoberturaKm: 30,
    tarifas: T(60_000, 2_800, 5_000, 16_000),
    vehiculos: [
      {
        tipo: "CAMION",
        marca: "Iveco",
        modelo: "Daily 70C furgón",
        anio: 2019,
        patente: "AB456TY",
        capacidadKg: 3_500,
        volumenM3: 16,
      },
    ],
  });
  const lucia = await crearFletero({
    nombre: "Lucía",
    apellido: "Medina",
    email: "lucia@demo.test",
    telefono: "3815000007",
    dni: "38902115",
    bio: "Fletes chicos con Fiorino: cajas, bicicletas, muebles livianos. Puntualidad garantizada.",
    base: LUGARES.villaLujan,
    radioCoberturaKm: 12,
    tarifas: T(10_000, 1_100, 2_500, 14_000),
    vehiculos: [
      {
        tipo: "AUTO",
        marca: "Fiat",
        modelo: "Fiorino",
        anio: 2021,
        patente: "AG112RT",
        capacidadKg: 650,
        volumenM3: 3.2,
      },
    ],
  });
  const dario = await crearFletero({
    nombre: "Darío",
    apellido: "Paz",
    email: "dario@demo.test",
    telefono: "3815000008",
    dni: "40118773",
    bio: "Mensajería en moto por el microcentro y Barrio Sur.",
    base: LUGARES.barrioSur,
    radioCoberturaKm: 8,
    tarifas: T(3_500, 550, 0, 0),
    disponible: false,
    vehiculos: [
      {
        tipo: "MOTO",
        marca: "Motomel",
        modelo: "Blitz 110",
        anio: 2021,
        patente: "A456FGH",
        capacidadKg: 20,
        volumenM3: 0.06,
      },
    ],
  });
  const hector = await crearFletero({
    nombre: "Héctor",
    apellido: "Juárez",
    email: "hector@demo.test",
    telefono: "3815000009",
    dni: "20887341",
    bio: "Camión grande para mudanzas completas, materiales y cargas pesadas. Voy con dos ayudantes.",
    base: LUGARES.alderetes,
    radioCoberturaKm: 50,
    tarifas: T(120_000, 4_200, 6_500, 18_000),
    vehiculos: [
      {
        tipo: "CAMION",
        marca: "Ford",
        modelo: "Cargo 1722 con caja",
        anio: 2015,
        patente: "AA789QW",
        capacidadKg: 8_000,
        volumenM3: 40,
      },
    ],
  });
  const fernanda = await crearFletero({
    nombre: "Fernanda",
    apellido: "Ruiz",
    email: "fernanda@demo.test",
    telefono: "3815000010",
    dni: "31445620",
    bio: "Sprinter furgón: ideal para mudanzas de departamento y muebles que no pueden mojarse.",
    base: LUGARES.elManantial,
    radioCoberturaKm: 25,
    tarifas: T(35_000, 2_200, 4_500, 15_000),
    vehiculos: [
      {
        tipo: "CAMIONETA",
        marca: "Mercedes-Benz",
        modelo: "Sprinter furgón",
        anio: 2018,
        patente: "AD998MN",
        capacidadKg: 1_500,
        volumenM3: 10,
      },
    ],
  });
  await crearFletero({
    nombre: "Nicolás",
    apellido: "Ledesma",
    email: "nicolas@demo.test",
    telefono: "3815000011",
    dni: "37002984",
    bio: "Fletes en Las Talitas, Tafí Viejo y zona norte de la capital.",
    base: LUGARES.lasTalitas,
    radioCoberturaKm: 15,
    tarifas: T(11_000, 1_150, 2_800, 14_000),
    verificado: false,
    vehiculos: [
      {
        tipo: "AUTO",
        marca: "Peugeot",
        modelo: "Partner",
        anio: 2017,
        patente: "AF334LK",
        capacidadKg: 600,
        volumenM3: 3,
      },
    ],
  });
  await crearFletero({
    nombre: "Walter",
    apellido: "Coronel",
    email: "walter@demo.test",
    telefono: "3815000012",
    dni: "24561330",
    bio: "Fletes desde Lules y Famaillá a la capital. También cosecha y materiales de corralón.",
    base: LUGARES.lules,
    radioCoberturaKm: 35,
    tarifas: T(20_000, 1_600, 3_000, 13_000),
    vehiculos: [
      {
        tipo: "CAMIONETA",
        marca: "Toyota",
        modelo: "Hilux con baranda",
        anio: 2013,
        patente: "NKD482",
        capacidadKg: 1_100,
        volumenM3: 3.8,
      },
    ],
  });
  await crearFletero({
    nombre: "Pablo",
    apellido: "Acosta",
    email: "pablo@demo.test",
    telefono: "3815000013",
    dni: "39876012",
    bio: "Envíos rápidos en moto desde el Parque 9 de Julio a toda la capital.",
    base: LUGARES.parque,
    radioCoberturaKm: 10,
    tarifas: T(4_000, 650, 0, 0),
    verificado: false,
    vehiculos: [
      {
        tipo: "MOTO",
        marca: "Yamaha",
        modelo: "YBR 125 con caja",
        anio: 2019,
        patente: "482KDS",
        capacidadKg: 30,
        volumenM3: 0.1,
      },
    ],
  });

  // Fletero recién registrado: sirve para probar el onboarding.
  const diego = await insertar<{ id: string }>(sb, "usuarios", {
    ...datosUsuario({
      nombre: "Diego",
      apellido: "Villagra",
      email: "diego@demo.test",
      telefono: "3815000014",
    }),
    rol: "FLETERO",
  });
  await insertar(sb, "perfiles_fletero", { userId: diego.id });

  // --- Solicitudes abiertas (para comparar presupuestos y para el feed de fleteros) ---
  const mudanzaAna = await crearSolicitud({
    cliente: ana,
    tipoFlete: "MUDANZA",
    titulo: "Mudanza de monoambiente",
    descripcion: "Primer piso por escalera en el origen. Lo único frágil es el televisor.",
    origen: LUGARES.barrioSur,
    destino: LUGARES.yerbaBuena,
    origenPiso: 1,
    destinoPiso: 0,
    fecha: dia(3),
    franja: "MANANA",
    tipoVehiculoSugerido: "CAMIONETA",
    ayudantesRequeridos: 1,
    creadaHaceDias: 1,
    items: [
      item("Cama de una plaza (desarmada)", 1, [200, 90, 40], 35),
      item("Colchón de una plaza", 1, [190, 90, 25], 15),
      item("Cajas medianas", 10, [50, 40, 40], 12),
      item('Televisor 43"', 1, [100, 15, 65], 10, true),
      item("Mesa de comedor", 1, [120, 80, 75], 25),
      item("Sillas", 4, [45, 45, 90], 6),
    ],
  });
  const presupuestoCarlos = await presupuestar(mudanzaAna, carlos, {
    mensaje: "Lo hago el sábado temprano. Voy con un ayudante y mantas.",
  });
  const presupuestoFernanda = await presupuestar(mudanzaAna, fernanda, {
    ajuste: -2_000,
    mensaje: "Furgón cerrado, nada se moja. Llego 8:30.",
  });
  await presupuestar(mudanzaAna, jose, { mensaje: "Con el camión entra todo en un viaje." });
  await conversar(mudanzaAna, carlos, [
    ["cliente", "Hola Carlos, ¿la cama entra desarmada en la caja?"],
    ["fletero", "Sí, sin problema. La atamos con la mesa para que no se mueva."],
    ["cliente", "Genial, gracias. Mañana te confirmo."],
  ]);

  const heladeraLuis = await crearSolicitud({
    cliente: luis,
    tipoFlete: "MUEBLES",
    titulo: "Heladera y lavarropas",
    descripcion: "Planta baja en los dos domicilios. La heladera tiene que ir parada.",
    origen: LUGARES.centro,
    destino: LUGARES.tafiViejo,
    fecha: dia(2),
    franja: "MEDIODIA",
    creadaHaceDias: 2,
    items: [
      item("Heladera con freezer", 1, [180, 70, 65], 70, true),
      item("Lavarropas automático", 1, [85, 60, 60], 65),
    ],
  });
  await presupuestar(heladeraLuis, carlos, { mensaje: "Tengo zorra para subirla parada." });
  await presupuestar(heladeraLuis, ramon, {
    ajuste: -1_500,
    mensaje: "Vuelvo para Tafí Viejo ese día, te hago precio.",
  });

  await crearSolicitud({
    cliente: luis,
    tipoFlete: "PAQUETERIA",
    titulo: "Sobre con documentación",
    origen: LUGARES.barrioNorte,
    destino: LUGARES.barrioSur,
    fecha: dia(1),
    franja: "MANANA",
    tipoVehiculoSugerido: "MOTO",
    creadaHaceDias: 0,
    items: [item("Sobre A4", 1, [35, 25, 2], 0.3)],
  });

  const placardValeria = await crearSolicitud({
    cliente: valeria,
    tipoFlete: "COMPRAS",
    titulo: "Placard en cajas desde el corralón",
    descripcion: "Son 3 cajas largas, no sé las medidas exactas.",
    origen: LUGARES.ciudadela,
    destino: LUGARES.yerbaBuena,
    fecha: dia(4),
    franja: "TARDE",
    creadaHaceDias: 1,
    items: [item("Cajas de placard 6 puertas", 3)],
  });
  await presupuestar(placardValeria, soledad, { mensaje: "Si las cajas miden más de 2 m, avisame." });

  const mudanzaMartin = await crearSolicitud({
    cliente: martin,
    tipoFlete: "MUDANZA",
    titulo: "Mudanza familiar: casa de 3 dormitorios",
    descripcion: "Casa en planta baja con patio. Hay que desarmar dos roperos.",
    origen: LUGARES.ciudadela,
    destino: LUGARES.lules,
    fecha: dia(6),
    franja: "FLEXIBLE",
    tipoVehiculoSugerido: "CAMION",
    ayudantesRequeridos: 2,
    creadaHaceDias: 2,
    items: [
      item("Cama de dos plazas", 1, [200, 160, 50], 60),
      item("Camas de una plaza", 2, [200, 90, 40], 35),
      item("Roperos (desarmados)", 2, [180, 60, 30], 70),
      item("Heladera", 1, [175, 70, 65], 70, true),
      item("Lavarropas", 1, [85, 60, 60], 65),
      item("Sillón de tres cuerpos", 1, [210, 90, 85], 55),
      item("Mesa y 6 sillas", 1, [160, 90, 75], 60),
      item("Cajas", 25, [50, 40, 40], 12),
    ],
  });
  await presupuestar(mudanzaMartin, hector, {
    mensaje: "Voy con dos ayudantes. Desarmamos y armamos los roperos.",
  });
  await presupuestar(mudanzaMartin, gustavo, {
    ajuste: -5_000,
    mensaje: "Puede que haga falta un segundo viaje para las cajas.",
  });

  await crearSolicitud({
    cliente: florencia,
    tipoFlete: "OTRO",
    titulo: "Bicicleta y caja de herramientas",
    origen: LUGARES.barrioNorte,
    destino: LUGARES.villaLujan,
    fecha: dia(2),
    franja: "TARDE",
    creadaHaceDias: 0,
    items: [
      item("Bicicleta rodado 29", 1, [180, 60, 100], 15),
      item("Caja de herramientas", 1, [60, 30, 30], 20),
    ],
  });

  // --- Fletes en curso: uno en cada etapa ---
  const compraAna = await crearSolicitud(
    {
      cliente: ana,
      tipoFlete: "COMPRAS",
      titulo: "Compra del mayorista",
      origen: LUGARES.abasto,
      destino: LUGARES.barrioSur,
      fecha: dia(1),
      franja: "TARDE",
      creadaHaceDias: 3,
      items: [
        item("Bolsas de mercadería", 6, [50, 35, 30], 8),
        item("Bidones de agua de 20 L", 4, [30, 30, 50], 21),
      ],
    },
    "ADJUDICADA",
  );
  const compraConfirmada = await adjudicar(compraAna, soledad, "CONFIRMADO", {
    mensaje: "Paso a las 17 por el Abasto.",
    competidores: [lucia],
  });
  await conversar(compraAna, soledad, [
    ["fletero", "Ana, ¿en qué puesto del Abasto te espero?"],
    ["cliente", "En la entrada de calle Bernabé Aráoz. Gracias."],
  ]);

  await adjudicar(
    await crearSolicitud(
      {
        cliente: carolina,
        tipoFlete: "MUEBLES",
        titulo: "Sillones y mesa ratona",
        origen: LUGARES.tafiViejo,
        destino: LUGARES.centro,
        destinoPiso: 3,
        destinoAscensor: true,
        fecha: dia(0),
        franja: "MANANA",
        creadaHaceDias: 4,
        items: [
          item("Sillón de dos cuerpos", 2, [160, 85, 80], 40),
          item("Mesa ratona de vidrio", 1, [100, 50, 45], 18, true),
        ],
      },
      "ADJUDICADA",
    ),
    ramon,
    "CARGANDO",
  );

  await adjudicar(
    await crearSolicitud(
      {
        cliente: jorge,
        tipoFlete: "OTRO",
        titulo: "Materiales para una ampliación",
        origen: LUGARES.banda,
        destino: LUGARES.alderetes,
        fecha: dia(0),
        franja: "MEDIODIA",
        tipoVehiculoSugerido: "CAMION",
        creadaHaceDias: 3,
        items: [
          item("Bolsas de cemento", 20, [60, 40, 12], 25),
          item("Chapas", 10, [300, 110, 2], 12),
          item("Ladrillos (pallet)", 1, [120, 100, 90], 900),
        ],
      },
      "ADJUDICADA",
    ),
    hector,
    "EN_TRASLADO",
  );

  // Entregado: a la espera de que el cliente confirme la recepción y califique.
  await adjudicar(
    await crearSolicitud(
      {
        cliente: valeria,
        tipoFlete: "MUEBLES",
        titulo: "Escritorio y biblioteca",
        origen: LUGARES.yerbaBuena,
        destino: LUGARES.villaCarmela,
        fecha: dia(-1),
        franja: "TARDE",
        creadaHaceDias: 5,
        items: [
          item("Escritorio", 1, [120, 60, 75], 30),
          item("Biblioteca", 1, [180, 80, 30], 40),
          item("Cajas con libros", 4, [40, 30, 30], 15),
        ],
      },
      "ADJUDICADA",
    ),
    lucia,
    "ENTREGADO",
  );

  // --- Historial: completados (con y sin calificación) y cancelados ---
  const completado = async (
    s: SolicitudSeed,
    fletero: Fletero,
    competidores: Fletero[] = [],
    incidencias = false,
  ) => adjudicar(await crearSolicitud(s, "ADJUDICADA"), fletero, "CERRADO", { competidores, incidencias });

  await calificar(
    await completado(
      {
        cliente: florencia,
        tipoFlete: "MUDANZA",
        titulo: "Mudanza de departamento",
        origen: LUGARES.barrioNorte,
        destino: LUGARES.yerbaBuena,
        origenPiso: 4,
        origenAscensor: true,
        fecha: dia(-10),
        franja: "MANANA",
        ayudantesRequeridos: 1,
        creadaHaceDias: 14,
        items: [
          item("Cama de dos plazas", 1, [200, 160, 50], 60),
          item("Cajas", 12, [50, 40, 40], 12),
          item("Sillón", 1, [180, 85, 80], 45),
        ],
      },
      carlos,
      [jose],
    ),
    5,
    "Puntual y muy cuidadoso. Subió todo con el ayudante y no se rayó nada.",
    9,
  );

  await calificar(
    await completado(
      {
        cliente: martin,
        tipoFlete: "COMPRAS",
        titulo: "Lavarropas nuevo",
        origen: LUGARES.abasto,
        destino: LUGARES.ciudadela,
        fecha: dia(-20),
        franja: "MEDIODIA",
        creadaHaceDias: 22,
        items: [item("Lavarropas en caja", 1, [90, 65, 65], 70)],
      },
      carlos,
    ),
    4,
    "Buen servicio, llegó media hora tarde pero avisó por el chat.",
    19,
  );

  await calificar(
    await completado(
      {
        cliente: sebastian,
        tipoFlete: "MUEBLES",
        titulo: "Cuadros y espejo de pie",
        origen: LUGARES.villaCarmela,
        destino: LUGARES.centro,
        fecha: dia(-15),
        franja: "TARDE",
        creadaHaceDias: 17,
        items: [
          item("Cuadros grandes", 3, [100, 10, 80], 6, true),
          item("Espejo de pie", 1, [170, 60, 5], 15, true),
        ],
      },
      soledad,
      [lucia],
    ),
    5,
    "Envolvió todo con plástico de burbujas. Impecable.",
    14,
  );

  await calificar(
    await completado(
      {
        cliente: jorge,
        tipoFlete: "MUDANZA",
        titulo: "Mudanza a Parque 9 de Julio",
        origen: LUGARES.banda,
        destino: LUGARES.parque,
        fecha: dia(-30),
        franja: "FLEXIBLE",
        ayudantesRequeridos: 2,
        creadaHaceDias: 33,
        items: [item("Muebles varios", 8, [150, 60, 80], 40), item("Cajas", 20, [50, 40, 40], 12)],
      },
      jose,
      [gustavo],
      true,
    ),
    3,
    "Llegó tarde y una caja se golpeó en el viaje. Lo demás, bien.",
    29,
  );

  await calificar(
    await completado(
      {
        cliente: carolina,
        tipoFlete: "MUEBLES",
        titulo: "Heladera usada",
        origen: LUGARES.lasTalitas,
        destino: LUGARES.tafiViejo,
        fecha: dia(-25),
        franja: "MANANA",
        creadaHaceDias: 27,
        items: [item("Heladera", 1, [170, 65, 65], 65, true)],
      },
      ramon,
    ),
    5,
    "Excelente, rápido y amable.",
    24,
  );

  // Completado sin calificar: Luis puede probar el flujo de calificación.
  await completado(
    {
      cliente: luis,
      tipoFlete: "PAQUETERIA",
      titulo: "Caja con repuestos",
      origen: LUGARES.centro,
      destino: LUGARES.parque,
      fecha: dia(-5),
      franja: "MANANA",
      creadaHaceDias: 6,
      items: [item("Caja de repuestos", 1, [40, 30, 25], 8)],
    },
    marta,
  );

  await adjudicar(
    await crearSolicitud(
      {
        cliente: sebastian,
        tipoFlete: "MUDANZA",
        titulo: "Mudanza de oficina",
        origen: LUGARES.centro,
        destino: LUGARES.villaCarmela,
        fecha: dia(-3),
        franja: "MANANA",
        creadaHaceDias: 7,
        items: [item("Escritorios", 2, [140, 70, 75], 35), item("Sillas de oficina", 4, [65, 65, 110], 12)],
      },
      "ADJUDICADA",
    ),
    gustavo,
    "CANCELADO",
    { notaCancelacion: "Se postergó la mudanza; la vuelvo a publicar más adelante." },
  );

  await crearSolicitud(
    {
      cliente: valeria,
      tipoFlete: "MUEBLES",
      titulo: "Sillón usado de Marketplace",
      origen: LUGARES.elManantial,
      destino: LUGARES.yerbaBuena,
      fecha: dia(-8),
      franja: "TARDE",
      creadaHaceDias: 10,
      items: [item("Sillón de dos cuerpos", 1, [160, 85, 80], 40)],
    },
    "CANCELADA",
  );

  const vencida = await crearSolicitud(
    {
      cliente: martin,
      tipoFlete: "OTRO",
      titulo: "Bicicleta al taller",
      origen: LUGARES.ciudadela,
      destino: LUGARES.barrioSur,
      fecha: dia(-12),
      franja: "MANANA",
      creadaHaceDias: 15,
      items: [item("Bicicleta", 1, [170, 60, 100], 14)],
    },
    "VENCIDA",
  );
  await presupuestar(vencida, dario, { estado: "RETIRADO", mensaje: "Al final no llego con la moto." });

  await recalcularRatings();
  await ajustarLecturas();

  // --- Estado de demo del chat ---
  // Ana todavía no leyó los presupuestos de su mudanza; Carlos no leyó la última respuesta de Ana.
  await actualizar(sb, "conversaciones", { solicitudId: mudanzaAna.id }, { leidoHastaCliente: null });
  await actualizar(sb, "conversaciones", { id: presupuestoCarlos.conversacionId }, { leidoHastaFletero: null });

  // Soledad propone cambiar el horario del flete confirmado: Ana lo acepta con un toque.
  const propuestaEn = hace(0, 1);
  const propuestaMsg = await insertar<{ id: string }>(sb, "mensajes", {
    conversacionId: compraConfirmada.conversacionId,
    autorId: soledad.userId,
    tipo: "PROPUESTA",
    createdAt: propuestaEn,
  });
  await insertar(sb, "propuestas_horario", {
    mensajeId: propuestaMsg.id,
    fecha: dia(2),
    franja: "MANANA",
    propuestaPorId: soledad.userId,
  });
  await actualizar(sb, "conversaciones", { id: compraConfirmada.conversacionId }, {
    ultimaActividadEn: propuestaEn,
    leidoHastaFletero: propuestaEn,
  });

  const chatAna = (conversacionId: string) => `/cliente/mensajes/${conversacionId}`;
  await notificacion(
    ana.userId,
    "PRESUPUESTO",
    "Carlos R. te envió un presupuesto",
    chatAna(presupuestoCarlos.conversacionId),
    "Mudanza de monoambiente",
  );
  await notificacion(
    ana.userId,
    "PRESUPUESTO",
    "Fernanda R. te envió un presupuesto",
    chatAna(presupuestoFernanda.conversacionId),
    "Mudanza de monoambiente",
  );
  await notificacion(
    ana.userId,
    "MENSAJE",
    "Mensajes de Soledad C.",
    chatAna(compraConfirmada.conversacionId),
    "Propuso una nueva fecha para el flete",
    `chat:${compraConfirmada.conversacionId}`,
  );
  await notificacion(
    carlos.userId,
    "MENSAJE",
    "Mensajes de Ana P.",
    `/fletero/mensajes/${presupuestoCarlos.conversacionId}`,
    "Genial, gracias. Mañana te confirmo.",
    `chat:${presupuestoCarlos.conversacionId}`,
  );
}

main()
  .then(async () => {
    const [usuarios, solicitudes, fletesN] = await Promise.all([
      contar(sb, "usuarios"),
      contar(sb, "solicitudes"),
      contar(sb, "fletes"),
    ]);
    console.log(`Seed listo: ${usuarios} usuarios, ${solicitudes} solicitudes, ${fletesN} fletes.`);
    console.log(`Contraseña de todos los usuarios de demo: ${PASSWORD_DEMO}`);
    console.log("  Admin:    admin@demo.test");
    console.log(
      "  Clientes: ana, luis, valeria, martin, carolina, jorge, florencia, sebastian  (@demo.test)",
    );
    console.log("            paula (sin dirección habitual), rocio (para la demo de contraseñas)");
    console.log(
      "  Fleteros: carlos (camioneta), marta (moto), jose (camión), soledad (auto), ramon, gustavo,",
    );
    console.log(
      "            lucia, dario (no disponible), hector, fernanda, nicolas, walter, pablo  (@demo.test)",
    );
    console.log("  Onboarding pendiente: diego@demo.test");
    console.log("Guion de la demo: docs/DEMO.md (en la raíz del repositorio).");
  })
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => undefined);
