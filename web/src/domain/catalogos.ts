// Etiquetas legibles de los enums del dominio. Las claves coinciden con los enums de Prisma
// (lo verifica `lib/catalogos-check.ts`).

export const TIPOS_VEHICULO = ["MOTO", "AUTO", "CAMIONETA", "CAMION"] as const;
export type TipoVehiculo = (typeof TIPOS_VEHICULO)[number];

export const TIPOS_FLETE = ["MUDANZA", "MUEBLES", "COMPRAS", "PAQUETERIA", "OTRO"] as const;
export type TipoFlete = (typeof TIPOS_FLETE)[number];

export const FRANJAS_HORARIAS = ["MANANA", "MEDIODIA", "TARDE", "FLEXIBLE"] as const;
export type FranjaHoraria = (typeof FRANJAS_HORARIAS)[number];

export const ETIQUETA_VEHICULO: Record<TipoVehiculo, string> = {
  MOTO: "Moto",
  AUTO: "Auto / utilitario",
  CAMIONETA: "Camioneta",
  CAMION: "Camión",
};

export const ETIQUETA_TIPO_FLETE: Record<TipoFlete, string> = {
  MUDANZA: "Mudanza",
  MUEBLES: "Muebles y electrodomésticos",
  COMPRAS: "Compras",
  PAQUETERIA: "Paquetería",
  OTRO: "Otro",
};

export const FRANJA: Record<FranjaHoraria, { etiqueta: string; desde: number; hasta: number }> = {
  MANANA: { etiqueta: "Mañana (8 a 12 h)", desde: 8, hasta: 12 },
  MEDIODIA: { etiqueta: "Mediodía (12 a 16 h)", desde: 12, hasta: 16 },
  TARDE: { etiqueta: "Tarde (16 a 20 h)", desde: 16, hasta: 20 },
  FLEXIBLE: { etiqueta: "Horario flexible", desde: 8, hasta: 20 },
};

/** Etapas que se guardan en el flete (existe desde que el cliente acepta un presupuesto). */
export const ETAPAS_FLETE = [
  "CONFIRMADO",
  "EN_CAMINO_A_ORIGEN",
  "CARGANDO",
  "EN_TRASLADO",
  "DESCARGANDO",
  "ENTREGADO",
  "CERRADO",
  "CANCELADO",
] as const;
export type EtapaFlete = (typeof ETAPAS_FLETE)[number];

export const ETIQUETA_ETAPA: Record<EtapaFlete, string> = {
  CONFIRMADO: "Confirmado",
  EN_CAMINO_A_ORIGEN: "En camino al origen",
  CARGANDO: "Cargando",
  EN_TRASLADO: "En traslado",
  DESCARGANDO: "Descargando",
  ENTREGADO: "Entregado",
  CERRADO: "Cerrado",
  CANCELADO: "Cancelado",
};

export const ESTADOS_INICIALES_ITEM = ["BUENO", "CON_MARCAS", "DANADO"] as const;
export type EstadoInicialItem = (typeof ESTADOS_INICIALES_ITEM)[number];

export const ETIQUETA_ESTADO_INICIAL: Record<EstadoInicialItem, string> = {
  BUENO: "En buen estado",
  CON_MARCAS: "Con marcas de uso",
  DANADO: "Con daños previos",
};

export const FASES_CONTROL = ["CARGA", "DESCARGA", "RECEPCION"] as const;
export type FaseControl = (typeof FASES_CONTROL)[number];

export const RESULTADOS_CONTROL = [
  "CARGADO",
  "NO_CARGADO",
  "ENTREGADO",
  "CON_DANO",
  "FALTANTE",
  "CONFORME",
  "RECLAMO",
] as const;
export type ResultadoControl = (typeof RESULTADOS_CONTROL)[number];

export const ETIQUETA_RESULTADO: Record<ResultadoControl, string> = {
  CARGADO: "Cargado",
  NO_CARGADO: "No se cargó",
  ENTREGADO: "Entregado",
  CON_DANO: "Entregado con daño",
  FALTANTE: "Faltante",
  CONFORME: "Recibido conforme",
  RECLAMO: "Con reclamo",
};

export const ESTADOS_RECLAMO = ["ABIERTO", "RESUELTO"] as const;
export type EstadoReclamo = (typeof ESTADOS_RECLAMO)[number];

export const ESTADOS_PRESUPUESTO = ["PENDIENTE", "ACEPTADO", "RECHAZADO", "RETIRADO"] as const;
export type EstadoPresupuesto = (typeof ESTADOS_PRESUPUESTO)[number];
