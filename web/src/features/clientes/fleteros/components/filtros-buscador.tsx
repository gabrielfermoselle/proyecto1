"use client";

import { Search } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { ETIQUETA_VEHICULO, TIPOS_VEHICULO } from "@/domain/catalogos";
import { AddressAutocomplete } from "@/features/mapas/components/address-autocomplete";
import type { ParametrosBuscadorUrl, Referencia } from "../parametros";

interface FiltrosBuscadorProps {
  valores: ParametrosBuscadorUrl;
  /** Referencia que se aplicó de verdad (puede diferir de la pedida si no era válida). */
  referenciaAplicada: Referencia;
  direccionHabitual: string | null;
  solicitudes: { id: string; titulo: string }[];
}

const ETIQUETA_RADIO: Record<ParametrosBuscadorUrl["radio"], string> = {
  zona: "Que lleguen a ese punto",
  "5": "Hasta 5 km",
  "10": "Hasta 10 km",
  "20": "Hasta 20 km",
  "50": "Hasta 50 km",
  todos: "Cualquier distancia",
};

/** Formulario GET: los filtros quedan en la URL (se pueden compartir y volver atrás). */
export function FiltrosBuscador({
  valores,
  referenciaAplicada,
  direccionHabitual,
  solicitudes,
}: FiltrosBuscadorProps) {
  const [ref, setRef] = useState<Referencia>(referenciaAplicada);
  const [escrita, setEscrita] = useState(
    valores.ref === "direccion" && valores.lat !== undefined && valores.lng !== undefined
      ? { lat: valores.lat, lng: valores.lng, direccion: valores.dir ?? "" }
      : null,
  );
  const conSolicitud = ref === "solicitud";

  return (
    <form method="get" action="/cliente/fleteros" className="grid gap-5 rounded-lg border bg-card p-4">
      <fieldset className="grid gap-3">
        <legend className="mb-1 text-sm font-semibold">Buscar cerca de</legend>
        <div className="flex flex-wrap gap-x-5 gap-y-2">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="ref"
              value="habitual"
              checked={ref === "habitual"}
              onChange={() => setRef("habitual")}
              className="size-5 accent-[hsl(var(--primary))]"
            />
            Mi dirección habitual
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="ref"
              value="solicitud"
              checked={ref === "solicitud"}
              onChange={() => setRef("solicitud")}
              disabled={solicitudes.length === 0}
              className="size-5 accent-[hsl(var(--primary))]"
            />
            Una de mis solicitudes
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="ref"
              value="direccion"
              checked={ref === "direccion"}
              onChange={() => setRef("direccion")}
              className="size-5 accent-[hsl(var(--primary))]"
            />
            Otra dirección
          </label>
        </div>

        {ref === "habitual" ? (
          <p className="text-sm text-muted-foreground">
            {direccionHabitual ? (
              <>Desde {direccionHabitual}.</>
            ) : (
              <>
                Todavía no cargaste tu dirección.{" "}
                <Link
                  href="/perfil#direccion"
                  className="font-semibold text-primary underline-offset-4 hover:underline"
                >
                  Cargala en tu perfil
                </Link>{" "}
                para ver primero a los más cercanos.
              </>
            )}
          </p>
        ) : null}

        {ref === "solicitud" ? (
          <div className="grid gap-2 sm:max-w-md">
            <Label htmlFor="solicitud">Solicitud</Label>
            <Select id="solicitud" name="solicitud" defaultValue={valores.solicitud ?? solicitudes[0]?.id}>
              {solicitudes.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.titulo}
                </option>
              ))}
            </Select>
            <p className="text-sm text-muted-foreground">
              Medimos desde el origen y te mostramos un precio estimado para esa carga.
            </p>
          </div>
        ) : null}

        {ref === "direccion" ? (
          <div className="grid gap-2 sm:max-w-md">
            <AddressAutocomplete
              label="Dirección"
              placeholder="Ej.: Av. Aconquija 1500, Yerba Buena"
              {...(escrita?.direccion ? { hint: `Elegida: ${escrita.direccion}` } : {})}
              onSelect={({ lat, lng, direccion }) => setEscrita({ lat, lng, direccion })}
            />
            {escrita ? (
              <>
                <input type="hidden" name="lat" value={escrita.lat} />
                <input type="hidden" name="lng" value={escrita.lng} />
                <input type="hidden" name="dir" value={escrita.direccion} />
              </>
            ) : null}
          </div>
        ) : null}
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="grid gap-2">
          <Label htmlFor="radio">Distancia</Label>
          <Select id="radio" name="radio" defaultValue={valores.radio}>
            {(Object.keys(ETIQUETA_RADIO) as ParametrosBuscadorUrl["radio"][]).map((r) => (
              <option key={r} value={r}>
                {ETIQUETA_RADIO[r]}
              </option>
            ))}
          </Select>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="vehiculo">Vehículo</Label>
          <Select id="vehiculo" name="vehiculo" defaultValue={valores.vehiculo ?? ""}>
            <option value="">Cualquiera</option>
            {TIPOS_VEHICULO.map((t) => (
              <option key={t} value={t}>
                {ETIQUETA_VEHICULO[t]}
              </option>
            ))}
          </Select>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="precioMax">Precio mínimo hasta ($)</Label>
          <Input
            id="precioMax"
            name="precioMax"
            type="number"
            inputMode="numeric"
            min={1}
            step={500}
            placeholder="Sin tope"
            defaultValue={valores.precioMax ?? ""}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="rating">Calificación</Label>
          <Select id="rating" name="rating" defaultValue={valores.rating ?? ""}>
            <option value="">Cualquiera</option>
            <option value="3">3 estrellas o más</option>
            <option value="4">4 estrellas o más</option>
            <option value="4.5">4,5 estrellas o más</option>
          </Select>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="orden">Ordenar por</Label>
          <Select id="orden" name="orden" defaultValue={valores.orden}>
            <option value="distancia">Más cerca</option>
            <option value="precio">{conSolicitud ? "Menor precio estimado" : "Menor precio mínimo"}</option>
            <option value="calificacion">Mejor calificados</option>
            <option value="experiencia">Más reseñas</option>
          </Select>
        </div>
        <label className="flex items-center gap-2 self-end py-2.5 text-sm font-semibold">
          <input
            type="checkbox"
            name="todos"
            value="1"
            defaultChecked={valores.todos === "1"}
            className="size-5 accent-[hsl(var(--primary))]"
          />
          Incluir en pausa
        </label>
      </div>

      <Button type="submit" className="w-full sm:w-auto sm:justify-self-end">
        <Search aria-hidden="true" />
        Buscar
      </Button>
    </form>
  );
}
