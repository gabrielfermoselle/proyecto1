import { Bike, Car, Truck, Van, type LucideProps } from "lucide-react";
import type { TipoVehiculo } from "@/domain/catalogos";

const ICONOS: Record<TipoVehiculo, React.ComponentType<LucideProps>> = {
  MOTO: Bike,
  AUTO: Car,
  CAMIONETA: Van,
  CAMION: Truck,
};

export function VehiculoIcono({ tipo, ...props }: { tipo: TipoVehiculo } & LucideProps) {
  const Icono = ICONOS[tipo];
  return <Icono aria-hidden="true" {...props} />;
}

/** Capacidades de referencia para orientar al fletero al cargar su vehículo. */
export const REFERENCIA_CAPACIDAD: Record<TipoVehiculo, string> = {
  MOTO: "Una moto con baúl lleva unos 25 kg y 0,08 m³.",
  AUTO: "Un utilitario (Kangoo, Fiorino) lleva unos 600 kg y 3 m³.",
  CAMIONETA: "Una camioneta con caja lleva unos 1.000 kg y 3,5 m³; un furgón, hasta 10 m³.",
  CAMION: "Un camión mediano lleva de 3.500 a 8.000 kg y de 16 a 40 m³.",
};
