"use client";

import { SlidersHorizontal } from "lucide-react";
import Link from "next/link";
import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { ETIQUETA_TIPO_FLETE, TIPOS_FLETE } from "@/domain/catalogos";
import type { ParametrosFeedUrl } from "../parametros";

/**
 * Filtros del feed: zona, fecha y tipo. Es un formulario GET (funciona sin JavaScript); con
 * JavaScript se aplica apenas cambia un valor.
 */
export function FiltrosFeed({
  params,
  radioKm,
  conFiltros,
}: {
  params: ParametrosFeedUrl;
  radioKm: number;
  conFiltros: boolean;
}) {
  const form = useRef<HTMLFormElement>(null);
  const aplicar = () => form.current?.requestSubmit();
  const zonas = (["3", "5", "10"] as const).filter((z) => Number(z) < radioKm);

  return (
    <form
      ref={form}
      method="get"
      action="/fletero"
      aria-label="Filtros"
      className="grid gap-3 rounded-xl border bg-card p-3 shadow-sm sm:grid-cols-3 lg:flex lg:items-end"
    >
      {params.vista !== "lista" ? <input type="hidden" name="vista" value={params.vista} /> : null}
      {params.orden !== "distancia" ? <input type="hidden" name="orden" value={params.orden} /> : null}
      <div className="grid gap-1.5 lg:w-48">
        <Label htmlFor="filtro-zona">Zona</Label>
        <Select id="filtro-zona" name="zona" defaultValue={params.zona} onChange={aplicar}>
          <option value="todas">Todo mi radio ({radioKm} km)</option>
          {zonas.map((z) => (
            <option key={z} value={z}>
              Hasta {z} km de mi base
            </option>
          ))}
        </Select>
      </div>
      <div className="grid gap-1.5 lg:w-48">
        <Label htmlFor="filtro-fecha">Fecha</Label>
        <Select id="filtro-fecha" name="fecha" defaultValue={params.fecha} onChange={aplicar}>
          <option value="todas">Cualquier día</option>
          <option value="hoy">Hoy</option>
          <option value="manana">Mañana</option>
          <option value="semana">Próximos 7 días</option>
        </Select>
      </div>
      <div className="grid gap-1.5 lg:w-56">
        <Label htmlFor="filtro-tipo">Tipo</Label>
        <Select id="filtro-tipo" name="tipo" defaultValue={params.tipo} onChange={aplicar}>
          <option value="todos">Todos los tipos</option>
          {TIPOS_FLETE.map((t) => (
            <option key={t} value={t}>
              {ETIQUETA_TIPO_FLETE[t]}
            </option>
          ))}
        </Select>
      </div>
      <div className="flex items-center gap-2 sm:col-span-3 lg:ml-auto">
        <noscript>
          <Button type="submit" variant="outline">
            <SlidersHorizontal aria-hidden="true" />
            Filtrar
          </Button>
        </noscript>
        {conFiltros ? (
          <Button asChild variant="ghost" size="sm">
            <Link href="/fletero">Limpiar filtros</Link>
          </Button>
        ) : null}
      </div>
    </form>
  );
}
