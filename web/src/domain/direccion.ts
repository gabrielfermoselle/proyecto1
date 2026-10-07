// Direcciones aproximadas: antes de que el cliente acepte un presupuesto, el fletero ve la
// calle y el barrio pero no la altura. Se quita el número de puerta que va al final de un
// tramo ("Av. Roca 420, Barrio Sur" → "Av. Roca, Barrio Sur") sin tocar nombres con
// números ("24 de Septiembre", "Av. 9 de Julio") ni rutas o kilómetros ("Ruta 338").

const ALTURA = /(?<!\b(?:Ruta|RN|RP|Km|km|KM))\s+(?:N[°º]\s*)?\d+[A-Za-z]?(?=\s*(?:,|$))/g;

export function direccionAproximada(direccion: string): string {
  return direccion
    .replace(ALTURA, "")
    .replace(/\s+,/g, ",")
    .replace(/\s{2,}/g, " ")
    .trim();
}
