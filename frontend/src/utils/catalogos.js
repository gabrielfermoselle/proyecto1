// Catálogos compartidos con el backend (backend/src/constants.js).

export const CENTRO_TUCUMAN = [-26.8083, -65.2176];

export const VEHICULOS = [
  { id: "moto", label: "Moto" },
  { id: "auto", label: "Auto" },
  { id: "camioneta", label: "Camioneta" },
  { id: "camion", label: "Camión" }
];
export const VEHICULO_LABEL = Object.fromEntries(VEHICULOS.map((v) => [v.id, v.label]));

export const TIPOS_CARGA = [
  { id: "mudanza", label: "Mudanza" },
  { id: "mueble", label: "Mueble" },
  { id: "compra", label: "Compra" },
  { id: "paquete", label: "Paquete" },
  { id: "otro", label: "Otro" }
];
export const CARGA_LABEL = Object.fromEntries(TIPOS_CARGA.map((t) => [t.id, t.label]));

// Etapas del flete, en orden, para el seguimiento.
export const ETAPAS = [
  { id: "publicada", label: "Publicada" },
  { id: "confirmada", label: "Confirmada" },
  { id: "en_transito", label: "En traslado" },
  { id: "entregada", label: "Entregada" },
  { id: "completada", label: "Completada" }
];

export const ESTADO_LABEL = {
  ...Object.fromEntries(ETAPAS.map((e) => [e.id, e.label])),
  cancelada: "Cancelada"
};

export const ESTADO_DOT = {
  publicada: "var(--warn)",
  confirmada: "var(--teal-bright)",
  en_transito: "var(--started)",
  entregada: "var(--gold)",
  completada: "var(--success)",
  cancelada: "var(--danger)"
};

export const ESTADOS_ACTIVOS = ["publicada", "confirmada", "en_transito", "entregada"];
