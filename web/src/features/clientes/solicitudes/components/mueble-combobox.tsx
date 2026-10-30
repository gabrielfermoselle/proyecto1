"use client";

import { Package, PencilLine } from "lucide-react";
import Image from "next/image";
import * as React from "react";
import { FormField } from "@/components/shared/form-field";
import { buscarMueble, sugerirMuebles, type MuebleEstandar } from "@/domain/muebles";
import { cn } from "@/lib/utils";

type MuebleComboboxProps = React.ComponentProps<typeof FormField> & {
  texto: string;
  /** Base de las miniaturas en Supabase; sin ella se muestra un ícono. */
  urlFotos: string | null;
  /** `null` cuando se elige lo escrito tal cual, sin medidas típicas. */
  onElegir: (mueble: MuebleEstandar | null) => void;
};

/** Campo "Qué es" que sugiere muebles comunes (patrón combobox ARIA 1.2) mientras se escribe. */
export const MuebleCombobox = React.forwardRef<HTMLInputElement, MuebleComboboxProps>(
  ({ texto, urlFotos, onElegir, id, name, onChange, onBlur, ...props }, ref) => {
    const listboxId = `${id ?? name}-muebles`;
    const [abierto, setAbierto] = React.useState(false);
    const [activo, setActivo] = React.useState(-1);
    const escrito = texto.trim();
    const opciones: (MuebleEstandar | null)[] = [
      ...(escrito && !buscarMueble(escrito) ? [null] : []),
      ...sugerirMuebles(texto),
    ];
    const mostrar = abierto && opciones.length > 0;

    function elegir(mueble: MuebleEstandar | null) {
      setAbierto(false);
      setActivo(-1);
      onElegir(mueble);
    }

    function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
      if (!mostrar) return;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActivo((i) => (i + 1) % opciones.length);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActivo((i) => (i <= 0 ? opciones.length - 1 : i - 1));
      } else if (e.key === "Enter" && activo >= 0) {
        e.preventDefault();
        const elegido = opciones[activo];
        if (elegido !== undefined) elegir(elegido);
      } else if (e.key === "Escape") {
        setAbierto(false);
      }
    }

    return (
      <div className="relative">
        <FormField
          ref={ref}
          id={id}
          name={name}
          role="combobox"
          aria-expanded={mostrar}
          aria-controls={listboxId}
          aria-autocomplete="list"
          aria-activedescendant={mostrar && activo >= 0 ? `${listboxId}-${activo}` : undefined}
          autoComplete="off"
          onChange={(e) => {
            setAbierto(true);
            setActivo(-1);
            onChange?.(e);
          }}
          onBlur={(e) => {
            setAbierto(false);
            onBlur?.(e);
          }}
          onKeyDown={onKeyDown}
          {...props}
        />
        <ul
          id={listboxId}
          role="listbox"
          aria-label="Muebles sugeridos"
          hidden={!mostrar}
          className="absolute inset-x-0 top-full z-20 mt-1 max-h-72 overflow-auto rounded-lg border bg-popover p-1 shadow-lg"
        >
          {opciones.map((m, i) => (
            <li
              key={m?.nombre ?? "escrito"}
              id={`${listboxId}-${i}`}
              role="option"
              aria-selected={i === activo}
              tabIndex={-1}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => elegir(m)}
              className={cn(
                "flex cursor-pointer items-center gap-3 rounded-md px-3 py-2.5 text-sm",
                i === activo ? "bg-muted" : "hover:bg-muted/60",
                !m && opciones.length > 1 && "mb-1 border-b",
              )}
            >
              {m ? (
                <>
                  {urlFotos ? (
                    <Image
                      src={`${urlFotos}/${m.foto}`}
                      alt=""
                      width={40}
                      height={40}
                      className="size-10 shrink-0 rounded-md border bg-background"
                    />
                  ) : (
                    <span className="grid size-10 shrink-0 place-items-center rounded-md border bg-background">
                      <Package className="size-4 text-muted-foreground" aria-hidden="true" />
                    </span>
                  )}
                  <span className="grid">
                    <span className="font-medium">{m.nombre}</span>
                    <span className="text-xs text-muted-foreground">
                      {m.categoria} · {m.largoCm} × {m.anchoCm} × {m.altoCm} cm · {m.pesoKgAprox} kg aprox.
                    </span>
                  </span>
                </>
              ) : (
                <>
                  <span className="grid size-10 shrink-0 place-items-center rounded-md border bg-background">
                    <PencilLine className="size-4 text-primary" aria-hidden="true" />
                  </span>
                  <span className="grid">
                    <span className="font-medium">«{escrito}»</span>
                    <span className="text-xs text-muted-foreground">
                      Usar lo que escribiste y cargar las medidas a mano
                    </span>
                  </span>
                </>
              )}
            </li>
          ))}
        </ul>
      </div>
    );
  },
);
MuebleCombobox.displayName = "MuebleCombobox";
