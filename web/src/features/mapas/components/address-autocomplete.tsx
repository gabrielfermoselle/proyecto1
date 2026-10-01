"use client";

import { Loader2, MapPin, Search } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { buscarDirecciones, type ResultadoDireccion } from "../geocoding";

interface AddressAutocompleteProps {
  label: string;
  onSelect: (resultado: ResultadoDireccion) => void;
  placeholder?: string;
  hint?: string;
}

const MIN_CARACTERES = 3;
const ESPERA_MS = 350;

/** Combobox accesible (patrón ARIA 1.2) para buscar una dirección en Tucumán. */
export function AddressAutocomplete({ label, onSelect, placeholder, hint }: AddressAutocompleteProps) {
  const id = useId();
  const listboxId = `${id}-opciones`;
  const [texto, setTexto] = useState("");
  const [resultados, setResultados] = useState<ResultadoDireccion[]>([]);
  const [abierto, setAbierto] = useState(false);
  const [activo, setActivo] = useState(-1);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const contenedor = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const consulta = texto.trim();
    if (consulta.length < MIN_CARACTERES) {
      setResultados([]);
      return;
    }
    const controlador = new AbortController();
    const espera = setTimeout(async () => {
      setCargando(true);
      setError(null);
      try {
        const encontrados = await buscarDirecciones(consulta, controlador.signal);
        setResultados(encontrados);
        setActivo(-1);
        setAbierto(true);
      } catch (e) {
        if (!controlador.signal.aborted) setError(e instanceof Error ? e.message : "Error al buscar");
      } finally {
        if (!controlador.signal.aborted) setCargando(false);
      }
    }, ESPERA_MS);
    return () => {
      clearTimeout(espera);
      controlador.abort();
    };
  }, [texto]);

  function elegir(resultado: ResultadoDireccion) {
    setTexto(resultado.direccion);
    setAbierto(false);
    setResultados([]);
    onSelect(resultado);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!abierto || resultados.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActivo((i) => (i + 1) % resultados.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActivo((i) => (i <= 0 ? resultados.length - 1 : i - 1));
    } else if (e.key === "Enter" && activo >= 0) {
      e.preventDefault();
      const elegido = resultados[activo];
      if (elegido) elegir(elegido);
    } else if (e.key === "Escape") {
      setAbierto(false);
    }
  }

  const mostrarLista = abierto && resultados.length > 0;
  const sinResultados =
    abierto && !cargando && texto.trim().length >= MIN_CARACTERES && resultados.length === 0;

  return (
    <div
      ref={contenedor}
      className="relative grid gap-2"
      onBlur={(e) => {
        if (!contenedor.current?.contains(e.relatedTarget)) setAbierto(false);
      }}
    >
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <Input
          id={id}
          role="combobox"
          aria-expanded={mostrarLista}
          aria-controls={listboxId}
          aria-autocomplete="list"
          aria-activedescendant={activo >= 0 ? `${listboxId}-${activo}` : undefined}
          aria-describedby={hint ? `${id}-hint` : undefined}
          autoComplete="off"
          placeholder={placeholder}
          value={texto}
          onChange={(e) => {
            setTexto(e.target.value);
            setAbierto(true);
          }}
          onFocus={() => resultados.length > 0 && setAbierto(true)}
          onKeyDown={onKeyDown}
          className="pl-9 pr-9"
        />
        {cargando ? (
          <Loader2
            className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground"
            aria-hidden="true"
          />
        ) : null}
      </div>
      {hint ? (
        <p id={`${id}-hint`} className="text-sm text-muted-foreground">
          {hint}
        </p>
      ) : null}
      <p className="sr-only" aria-live="polite">
        {mostrarLista
          ? `${resultados.length} direcciones encontradas`
          : sinResultados
            ? "Sin resultados"
            : ""}
      </p>
      {error ? <p className="text-sm font-medium text-destructive">{error}</p> : null}

      <ul
        id={listboxId}
        role="listbox"
        aria-label="Direcciones sugeridas"
        hidden={!mostrarLista}
        className="absolute inset-x-0 top-full z-20 mt-1 max-h-72 overflow-auto rounded-md border bg-popover py-1 shadow-lg"
      >
        {resultados.map((resultado, i) => (
          <li
            key={resultado.id}
            id={`${listboxId}-${i}`}
            role="option"
            aria-selected={i === activo}
            tabIndex={-1}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => elegir(resultado)}
            className={cn(
              "flex cursor-pointer items-start gap-2 px-3 py-3 text-sm",
              i === activo ? "bg-muted" : "hover:bg-muted/60",
            )}
          >
            <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            {resultado.direccion}
          </li>
        ))}
      </ul>
      {sinResultados ? (
        <p className="text-sm text-muted-foreground">
          No encontramos esa dirección. Probá con calle y altura, o marcá el punto en el mapa.
        </p>
      ) : null}
    </div>
  );
}
