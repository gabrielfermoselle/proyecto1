// Vigencia de una sesión. La sesión es un JWT sin estado (7 días): para que cambiar o recuperar
// la contraseña cierre las sesiones abiertas en otros dispositivos, el usuario guarda cuándo
// cambió sus credenciales y el token, cuándo se inició sesión.

/**
 * @param autenticadoEnMs cuándo se inició la sesión (claim del JWT, en ms). Los tokens emitidos
 *   antes de que existiera el claim no lo tienen.
 * @param credencialesCambiadasEn último cambio de contraseña, o null si nunca la cambió.
 */
export function sesionVigente(autenticadoEnMs: number | undefined, credencialesCambiadasEn: Date | null): boolean {
  if (!credencialesCambiadasEn) return true;
  if (autenticadoEnMs === undefined) return false;
  return autenticadoEnMs >= credencialesCambiadasEn.getTime();
}
