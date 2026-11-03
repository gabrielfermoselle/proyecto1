"use client";

import { Loader2, MapPin, Search } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { FieldShell } from "@/components/shared/field-shell";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { buscarDirecciones, type ResultadoDireccion } from "../geocoding";

interface AddressAutocompleteProps {
  label: string;
  onSelect: (resultado: ResultadoDireccion) => void;
  placeholder?: string;
  hint?: string;
  /** Qué hacer cuando se elige una calle sin la altura exacta. */
  avisoAproximada?: string;
  /**
   * Con `value`, el campo es la dirección que se guarda: se puede editar a mano después de elegir
   * una sugerencia, y lo que quede escrito es lo que vale.
   */
  value?: string;
  onTextoChange?: (texto: string) => void;
  onBlur?: () => void;
  name?: string;
  error?: string | undefined;
  inputRef?: React.Ref<HTMLInputElement>;
}

const MIN_CARACTERES = 3;
const ESPERA_MS = 350;

/** Combobox accesible (patrón ARIA 1.2) para buscar una dirección en Tucumán. */
export function AddressAutocomplete({
  label,
  onSelect,
  placeholder,
  hint,
  avisoAproximada = "Encontramos la calle, pero no la altura exacta. Mové el pin en el mapa hasta la puerta.",
  value,
  onTextoChange,
  onBlur,
  name,
  error: errorCampo,
  inputRef,
}: AddressAutocompleteProps) {
  const id = useId();
  const listboxId = `${id}-opciones`;
  const [textoPropio, setTextoPropio] = useState("");
  const texto = value ?? textoPropio;
  // Solo lo que tipea el usuario dispara una búsqueda; no la dirección que llega del mapa.
  const [consulta, setConsulta] = useState("");
  const [resultados, setResultados] = useState<ResultadoDireccion[]>([]);
  const [buscada, setBuscada] = useState("");
  const [abierto, setAbierto] = useState(false);
  const [activo, setActivo] = useState(-1);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aproximada, setAproximada] = useState(false);
  const contenedor = useRef<HTMLDivElement>(null);

  useEffect(() => {
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
        setBuscada(consulta);
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
  }, [consulta]);

  function cambiarTexto(nuevo: string) {
    if (value === undefined) setTextoPropio(nuevo);
    onTextoChange?.(nuevo);
  }

  function elegir(resultado: ResultadoDireccion) {
    cambiarTexto(resultado.direccion);
    setConsulta("");
    setAproximada(resultado.aproximada);
    setAbierto(false);
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
    abierto &&
    !cargando &&
    buscada === consulta &&
    consulta.length >= MIN_CARACTERES &&
    resultados.length === 0;

  return (
    <div
      ref={contenedor}
      className="grid gap-2"
      onBlur={(e) => {
        if (!contenedor.current?.contains(e.relatedTarget)) setAbierto(false);
      }}
    >
      <FieldShell id={id} label={label} hint={hint} error={errorCampo}>
        {(aria) => (
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              {...aria}
              ref={inputRef}
              name={name}
              role="combobox"
              aria-expanded={mostrarLista}
              aria-controls={listboxId}
              aria-autocomplete="list"
              aria-activedescendant={mostrarLista && activo >= 0 ? `${listboxId}-${activo}` : undefined}
              autoComplete="off"
              placeholder={placeholder}
              value={texto}
              onChange={(e) => {
                cambiarTexto(e.target.value);
                setConsulta(e.target.value.trim());
                setAproximada(false);
                setAbierto(true);
              }}
              onFocus={() => resultados.length > 0 && setAbierto(true)}
              onBlur={onBlur}
              onKeyDown={onKeyDown}
              className="pl-9 pr-9"
            />
            {cargando ? (
              <Loader2
                className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground"
                aria-hidden="true"
              />
            ) : null}
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
                  <span className="grid">
                    {resultado.direccion}
                    {resultado.aproximada ? (
                      <span className="text-xs text-muted-foreground">
                        Altura aproximada: ubicamos la calle
                      </span>
                    ) : null}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </FieldShell>
      <p className="sr-only" aria-live="polite">
        {mostrarLista
          ? `${resultados.length} direcciones encontradas`
          : sinResultados
            ? "Sin resultados"
            : ""}
      </p>
      {error ? <p className="text-sm font-medium text-destructive">{error}</p> : null}
      {sinResultados ? (
        <p className="text-sm text-muted-foreground">
          {value === undefined
            ? "No encontramos esa dirección. Probá con calle y altura."
            : "No la encontramos en el mapa. Podés dejarla escrita así y marcar el punto en el mapa."}
        </p>
      ) : null}
      {aproximada && !abierto ? (
        <p role="status" className="flex items-start gap-2 text-sm font-medium">
          <MapPin className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
          {avisoAproximada}
        </p>
      ) : null}
    </div>
  );
}
