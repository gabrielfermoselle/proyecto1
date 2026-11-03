// Direcciones aproximadas: antes de que el cliente acepte un presupuesto, el fletero ve la
// calle y el barrio pero no la altura. En cada tramo separado por comas se corta desde el número
// de puerta hasta el final, así tampoco se filtra lo que el cliente escriba después
// ("Av. Roca 420 Dpto 3B, Barrio Sur" → "Av. Roca, Barrio Sur"). No se tocan nombres con números
// ("24 de Septiembre", "Av. 9 de Julio") ni rutas o kilómetros ("Ruta 338").

const DESDE_ALTURA = /(?<!\b(?:Ruta|RN|RP|Km))\s+(?:al\s+|N[°º]\s*)?\d+[A-Za-z]?\b(?!\s+de\b).*$/i;

export function direccionAproximada(direccion: string): string {
  return direccion
    .split(",")
    .map((tramo) =>
      tramo
        .replace(DESDE_ALTURA, "")
        .replace(/\s{2,}/g, " ")
        .trim(),
    )
    .filter(Boolean)
    .join(", ");
}
