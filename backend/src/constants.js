// Catálogos del dominio. Se mantienen genéricos a propósito: las especificaciones
// finales (capacidades, tarifas, reglas por tipo de carga) se completan más adelante.

export const ROLES = ["cliente", "fletero"];

export const TIPOS_VEHICULO = ["moto", "auto", "camioneta", "camion"];

export const TIPOS_CARGA = ["mudanza", "mueble", "compra", "paquete", "otro"];

// Ciclo de vida de una solicitud de flete (ver "Funcionamiento" del documento del proyecto):
// publicada → confirmada → en_transito → entregada → completada   (+ cancelada)
//   publicada:   el cliente publicó la solicitud y recibe presupuestos.
//   confirmada:  el cliente eligió un presupuesto; el fletero registra la carga.
//   en_transito: se realiza el traslado.
//   entregada:   el fletero registró la descarga.
//   completada:  el cliente confirmó la recepción (habilita la calificación).
export const ESTADOS = ["publicada", "confirmada", "en_transito", "entregada", "completada", "cancelada"];

// Transiciones permitidas y quién puede aplicarlas.
export const TRANSICIONES = {
  publicada: { cancelada: ["cliente"] },
  confirmada: { en_transito: ["fletero"], cancelada: ["cliente", "fletero"] },
  en_transito: { entregada: ["fletero"] },
  entregada: { completada: ["cliente"] },
  completada: {},
  cancelada: {}
};

// Coordenadas de referencia: San Miguel de Tucumán.
export const CENTRO_TUCUMAN = { lat: -26.8083, lng: -65.2176 };
