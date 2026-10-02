// Del lado del navegador: la posición actual, si el usuario la comparte. Nunca bloquea: si la
// rechaza, el navegador no la soporta o tarda más de la cuenta, devuelve null.

export interface Posicion {
  lat: number;
  lng: number;
  precisionM: number | null;
}

export function obtenerPosicion({ esperaMs = 8_000 } = {}): Promise<Posicion | null> {
  if (typeof navigator === "undefined" || !navigator.geolocation) return Promise.resolve(null);
  return new Promise((resolve) => {
    // Algunos navegadores nunca llaman a ninguno de los dos callbacks si el permiso queda pendiente.
    const corte = setTimeout(() => resolve(null), esperaMs + 1_000);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        clearTimeout(corte);
        resolve({
          lat: coords.latitude,
          lng: coords.longitude,
          precisionM: Number.isFinite(coords.accuracy) ? Math.round(coords.accuracy) : null,
        });
      },
      () => {
        clearTimeout(corte);
        resolve(null);
      },
      // Una posición de hasta 1 minuto alcanza; pedir alta precisión en el celular tarda más.
      { enableHighAccuracy: false, timeout: esperaMs, maximumAge: 60_000 },
    );
  });
}
