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

export const ETAPAS_FLETE = [
  "CONFIRMADO",
  "CARGADO",
  "EN_TRANSITO",
  "ENTREGADO",
  "COMPLETADO",
  "CANCELADO",
] as const;
export type EtapaFlete = (typeof ETAPAS_FLETE)[number];

export const ETIQUETA_ETAPA: Record<EtapaFlete, string> = {
  CONFIRMADO: "Confirmado",
  CARGADO: "Cargado",
  EN_TRANSITO: "En viaje",
  ENTREGADO: "Entregado",
  COMPLETADO: "Completado",
  CANCELADO: "Cancelado",
};

export const ESTADOS_PRESUPUESTO = ["PENDIENTE", "ACEPTADO", "RECHAZADO", "RETIRADO"] as const;
export type EstadoPresupuesto = (typeof ESTADOS_PRESUPUESTO)[number];
