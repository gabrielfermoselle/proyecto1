/**
 * `/panel` es una página de servidor que redirige a la sección del rol. Así el cliente no
 * necesita conocer el rol después del login, y el `callbackUrl` se valida en el servidor.
 */
export function rutaDePanel(callbackUrl?: string | undefined): string {
  return callbackUrl ? `/panel?callbackUrl=${encodeURIComponent(callbackUrl)}` : "/panel";
}
