"use client";

import { BadgeCheck, FileImage, ImagePlus, Loader2, RefreshCw, X } from "lucide-react";
import Image from "next/image";
import { useId, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { ETIQUETA_DOCUMENTO, TIPOS_DOCUMENTO, type TipoDocumento } from "@/domain/catalogos";
import { comprimirImagen, subirImagen, type ConfigStorageCliente } from "@/features/uploads/subir-imagen";
import { formatearFecha } from "@/lib/formato";
import { cn } from "@/lib/utils";
import { eliminarDocumento, firmarSubidaDocumento, guardarDocumento } from "../actions";
import type { DocumentoSubido } from "../queries";

const AYUDA: Record<TipoDocumento, string> = {
  DNI_FRENTE: "Que se lean el nombre y el número.",
  DNI_DORSO: "El lado con el domicilio.",
  LICENCIA: "Vigente, de la categoría de tu vehículo.",
  SEGURO: "Póliza o constancia con la patente.",
};

function Documento({
  tipo,
  subido,
  storage,
}: {
  tipo: TipoDocumento;
  subido: DocumentoSubido | undefined;
  storage: ConfigStorageCliente;
}) {
  const inputId = useId();
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function subir(archivo: File | undefined) {
    if (!archivo) return;
    setSubiendo(true);
    setError(null);
    try {
      const firma = await firmarSubidaDocumento({ tipo });
      if (!firma.ok) throw new Error(firma.error);
      const { ruta } = await subirImagen(await comprimirImagen(archivo), firma.data, storage);
      const guardado = await guardarDocumento({ tipo, ruta });
      if (!guardado.ok) throw new Error(guardado.error);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo subir la foto.");
    } finally {
      setSubiendo(false);
    }
  }

  async function quitar() {
    const r = await eliminarDocumento({ tipo });
    if (!r.ok) setError(r.error);
  }

  return (
    <li className="grid content-start gap-3 rounded-lg border bg-background/60 p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="grid gap-0.5">
          <p className="font-semibold">{ETIQUETA_DOCUMENTO[tipo]}</p>
          <p className="text-xs text-muted-foreground">
            {subido ? `Subido el ${formatearFecha(subido.subidoEn)}` : AYUDA[tipo]}
          </p>
        </div>
        {subido ? (
          <button
            type="button"
            onClick={() => void quitar()}
            className="grid size-8 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X className="size-4" aria-hidden="true" />
            <span className="sr-only">Quitar {ETIQUETA_DOCUMENTO[tipo]}</span>
          </button>
        ) : null}
      </div>
      {subido?.url ? (
        <Image
          src={subido.url}
          alt={ETIQUETA_DOCUMENTO[tipo]}
          width={320}
          height={200}
          className="aspect-[16/10] w-full rounded-md border object-cover"
        />
      ) : subido ? (
        <span className="grid aspect-[16/10] place-items-center rounded-md border bg-muted text-muted-foreground">
          <FileImage className="size-6" aria-hidden="true" />
        </span>
      ) : null}
      <label
        htmlFor={inputId}
        className={cn(
          "flex cursor-pointer items-center justify-center gap-2 rounded-md border-2 border-dashed px-3 py-2.5 text-sm font-semibold text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring",
          subiendo && "pointer-events-none opacity-70",
        )}
      >
        {subiendo ? (
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        ) : subido ? (
          <RefreshCw className="size-4" aria-hidden="true" />
        ) : (
          <ImagePlus className="size-4" aria-hidden="true" />
        )}
        {subiendo ? "Subiendo…" : subido ? "Cambiar foto" : "Subir foto"}
        <input
          id={inputId}
          type="file"
          accept="image/*"
          className="sr-only"
          disabled={subiendo}
          onChange={(e) => {
            void subir(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
      </label>
      {error ? (
        <p role="alert" className="text-sm font-medium text-destructive">
          {error}
        </p>
      ) : null}
    </li>
  );
}

/** Documentos para la verificación: una foto por tipo. Solo los ven vos y la administración. */
export function DocumentosEditor({
  documentos,
  verificado,
  storage,
}: {
  documentos: DocumentoSubido[];
  verificado: boolean;
  storage: ConfigStorageCliente | null;
}) {
  const faltan = TIPOS_DOCUMENTO.filter((t) => !documentos.some((d) => d.tipo === t)).length;
  return (
    <div className="grid gap-4">
      {verificado ? (
        <Badge variant="success" className="justify-self-start py-1 text-sm">
          <BadgeCheck aria-hidden="true" />
          Verificado: los clientes ven la insignia en tus presupuestos
        </Badge>
      ) : (
        <p className="rounded-lg bg-accent/15 px-3 py-2 text-sm">
          {faltan > 0
            ? `Te ${faltan === 1 ? "falta 1 documento" : `faltan ${faltan} documentos`}. Con todos cargados, la administración te verifica y aparecés con la insignia «Verificado».`
            : "Ya cargaste todo. La administración lo revisa y te verifica."}
        </p>
      )}
      {storage ? (
        <ul className="grid gap-3 sm:grid-cols-2">
          {TIPOS_DOCUMENTO.map((t) => (
            <Documento key={t} tipo={t} subido={documentos.find((d) => d.tipo === t)} storage={storage} />
          ))}
        </ul>
      ) : (
        <p className="flex items-center gap-2 rounded-md border border-dashed px-3 py-2 text-sm text-muted-foreground">
          <ImagePlus className="size-4 shrink-0" aria-hidden="true" />
          La carga de documentos se habilita cuando la plataforma configure el almacenamiento de imágenes.
        </p>
      )}
    </div>
  );
}
