import { Badge, type BadgeVariant } from "@/components/ui/badge";
import type { EstadoPresupuesto } from "@/domain/catalogos";
import { estaVencido } from "@/domain/presupuesto";

const ESTADO: Record<EstadoPresupuesto | "VENCIDO", { texto: string; variante: BadgeVariant }> = {
  PENDIENTE: { texto: "Esperando respuesta", variante: "warning" },
  ACEPTADO: { texto: "Aceptado", variante: "success" },
  RECHAZADO: { texto: "No elegido", variante: "muted" },
  RETIRADO: { texto: "Retirado", variante: "muted" },
  VENCIDO: { texto: "Vencido", variante: "muted" },
};

/** Un presupuesto pendiente cuya validez ya pasó se muestra como vencido. */
export function estadoVisible(estado: EstadoPresupuesto, validoHasta: Date): EstadoPresupuesto | "VENCIDO" {
  return estado === "PENDIENTE" && estaVencido(validoHasta) ? "VENCIDO" : estado;
}

export function EstadoPresupuestoBadge({
  estado,
  validoHasta,
}: {
  estado: EstadoPresupuesto;
  validoHasta: Date;
}) {
  const { texto, variante } = ESTADO[estadoVisible(estado, validoHasta)];
  return <Badge variant={variante}>{texto}</Badge>;
}
