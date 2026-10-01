// Pasos del onboarding del fletero y cuándo se considera completo cada uno.

export const PASOS_ONBOARDING = ["datos", "vehiculos", "zona", "tarifas"] as const;
export type PasoOnboarding = (typeof PASOS_ONBOARDING)[number];

export const ETIQUETA_PASO: Record<PasoOnboarding, string> = {
  datos: "Tus datos",
  vehiculos: "Vehículos",
  zona: "Zona de trabajo",
  tarifas: "Tarifas",
};

export interface PerfilParaOnboarding {
  dni: string | null;
  telefono: string | null;
  vehiculosActivos: number;
  baseLat: number | null;
  baseLng: number | null;
  precioMinimo: number;
  precioPorKm: number;
}

export function esPasoOnboarding(valor: string): valor is PasoOnboarding {
  return (PASOS_ONBOARDING as readonly string[]).includes(valor);
}

export function pasosCompletos(perfil: PerfilParaOnboarding): Record<PasoOnboarding, boolean> {
  return {
    datos: Boolean(perfil.dni && perfil.telefono),
    vehiculos: perfil.vehiculosActivos > 0,
    zona: perfil.baseLat !== null && perfil.baseLng !== null,
    tarifas: perfil.precioMinimo > 0 && perfil.precioPorKm > 0,
  };
}

/** El primer paso sin completar, o null si ya está todo. */
export function primerPasoPendiente(perfil: PerfilParaOnboarding): PasoOnboarding | null {
  const completos = pasosCompletos(perfil);
  return PASOS_ONBOARDING.find((paso) => !completos[paso]) ?? null;
}

export function pasoSiguiente(paso: PasoOnboarding): PasoOnboarding | null {
  return PASOS_ONBOARDING[PASOS_ONBOARDING.indexOf(paso) + 1] ?? null;
}
