// Patentes argentinas: se guardan normalizadas (mayúsculas, sin espacios ni guiones).

const FORMATOS = [
  /^[A-Z]{2}\d{3}[A-Z]{2}$/, // Mercosur autos (AB123CD)
  /^[A-Z]{3}\d{3}$/, // anterior autos (ABC123)
  /^[A-Z]\d{3}[A-Z]{3}$/, // Mercosur motos (A123BCD)
  /^\d{3}[A-Z]{3}$/, // anterior motos (123ABC)
];

export function normalizarPatente(valor: string): string {
  return valor.toUpperCase().replace(/[\s.-]/g, "");
}

export function esPatenteValida(valor: string): boolean {
  const patente = normalizarPatente(valor);
  return FORMATOS.some((formato) => formato.test(patente));
}
