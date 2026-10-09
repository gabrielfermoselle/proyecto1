// Enlaces para contactar a la otra parte cuando ya hay un flete confirmado (antes, el contacto
// va solo por el chat de la plataforma).

/** Número nacional de 10 dígitos (característica + número, sin 0 ni 15), o null si no se reconoce. */
export function numeroNacional(telefono: string | null | undefined): string | null {
  if (!telefono) return null;
  let d = telefono.replace(/\D/g, "");
  if (d.startsWith("549") && d.length === 13) d = d.slice(3);
  else if (d.startsWith("54") && d.length === 12) d = d.slice(2);
  else if (d.startsWith("0") && d.length === 11) d = d.slice(1);
  return /^\d{10}$/.test(d) ? d : null;
}

export interface EnlacesContacto {
  whatsapp: string;
  llamar: string;
  /** Para mostrar: "381 411-2222". */
  visible: string;
}

export function enlacesContacto(
  telefono: string | null | undefined,
  mensaje?: string,
): EnlacesContacto | null {
  const n = numeroNacional(telefono);
  if (!n) return null;
  const texto = mensaje ? `?text=${encodeURIComponent(mensaje)}` : "";
  // La característica tiene de 2 a 4 dígitos; se muestra la de Tucumán (381) y el resto en bloques.
  const visible = n.startsWith("381")
    ? `381 ${n.slice(3, 6)}-${n.slice(6)}`
    : `${n.slice(0, 4)} ${n.slice(4)}`;
  return { whatsapp: `https://wa.me/549${n}${texto}`, llamar: `tel:+54${n}`, visible };
}
