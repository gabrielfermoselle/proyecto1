"use client";

import { Pencil, Plus, Power } from "lucide-react";
import { useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ETIQUETA_VEHICULO } from "@/domain/catalogos";
import { VehiculoIcono } from "@/features/fleteros/components/vehiculo-icono";
import { formatearKg, formatearM3 } from "@/lib/formato";
import { cn } from "@/lib/utils";
import type { ConfigStorageCliente } from "@/features/uploads/subir-imagen";
import { cambiarEstadoVehiculo } from "../actions";
import type { VehiculoPerfil } from "../queries";
import { FotosVehiculo } from "./fotos-vehiculo";
import { VehiculoForm } from "./vehiculo-form";

interface VehiculosEditorProps {
  vehiculos: VehiculoPerfil[];
  storage: ConfigStorageCliente | null;
}

export function VehiculosEditor({ vehiculos, storage }: VehiculosEditorProps) {
  // Sin vehículos, el formulario arranca abierto: es lo único que se puede hacer en este paso.
  const [editando, setEditando] = useState<string | "nuevo" | null>(vehiculos.length === 0 ? "nuevo" : null);
  const [error, setError] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();

  function cambiarEstado(id: string, activo: boolean) {
    setError(null);
    startTransition(async () => {
      const resultado = await cambiarEstadoVehiculo({ id, activo });
      if (!resultado.ok) setError(resultado.error);
    });
  }

  return (
    <div className="grid gap-4">
      {error ? (
        <p role="alert" className="text-sm font-medium text-destructive">
          {error}
        </p>
      ) : null}

      <ul className="grid gap-3">
        {vehiculos.map((v) => {
          const descripcion = `${v.marca} ${v.modelo}`;
          if (editando === v.id) {
            return (
              <li key={v.id}>
                <VehiculoForm
                  vehiculo={{ ...v, anio: v.anio ?? "" }}
                  onListo={() => setEditando(null)}
                  onCancelar={() => setEditando(null)}
                />
              </li>
            );
          }
          return (
            <li
              key={v.id}
              className={cn("grid gap-4 rounded-lg border bg-card p-4", !v.activo && "bg-muted/40")}
            >
              <div className="flex items-start gap-3">
                <span className="grid size-11 shrink-0 place-items-center rounded-md bg-secondary text-secondary-foreground">
                  <VehiculoIcono tipo={v.tipo} className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 font-bold">
                    {descripcion}
                    {v.anio ? <span className="font-normal text-muted-foreground">{v.anio}</span> : null}
                    {!v.activo ? <Badge variant="muted">Inactivo</Badge> : null}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {ETIQUETA_VEHICULO[v.tipo]} · {v.patente}
                  </p>
                  <p className="text-sm">
                    Lleva hasta <strong>{formatearKg(v.capacidadKg)}</strong> y{" "}
                    <strong>{formatearM3(v.volumenM3)}</strong>
                  </p>
                </div>
              </div>
              <FotosVehiculo vehiculoId={v.id} descripcion={descripcion} fotos={v.fotos} storage={storage} />
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setEditando(v.id)}>
                  <Pencil aria-hidden="true" />
                  Editar <span className="sr-only">{descripcion}</span>
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={pendiente}
                  onClick={() => cambiarEstado(v.id, !v.activo)}
                >
                  <Power aria-hidden="true" />
                  {v.activo ? "Desactivar" : "Activar"} <span className="sr-only">{descripcion}</span>
                </Button>
              </div>
            </li>
          );
        })}
      </ul>

      {editando === "nuevo" ? (
        <VehiculoForm
          onListo={() => setEditando(null)}
          {...(vehiculos.length > 0 ? { onCancelar: () => setEditando(null) } : {})}
        />
      ) : (
        <Button
          type="button"
          variant="outline"
          onClick={() => setEditando("nuevo")}
          className="justify-self-start"
        >
          <Plus aria-hidden="true" />
          Agregar otro vehículo
        </Button>
      )}
    </div>
  );
}
