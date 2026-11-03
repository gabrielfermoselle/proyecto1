/** Aviso bajo el mapa cuando falta el punto: la dirección se puede escribir a mano, pero el pin es obligatorio. */
export function ErrorPunto() {
  return (
    <p role="alert" className="text-sm font-medium text-destructive">
      Marcá el punto en el mapa: tocá donde es o elegí una sugerencia de la lista.
    </p>
  );
}
