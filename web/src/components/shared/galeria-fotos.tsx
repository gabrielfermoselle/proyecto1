import { ImageOff } from "lucide-react";
import Image from "next/image";

interface Foto {
  id: string;
  url: string;
  ancho: number | null;
  alto: number | null;
}

/** Grilla de fotos. Cada una abre el original en otra pestaña (zoom nativo del navegador en el celular). */
export function GaleriaFotos({ fotos, descripcion }: { fotos: Foto[]; descripcion: string }) {
  if (fotos.length === 0) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <ImageOff className="size-4" aria-hidden="true" />
        No hay fotos cargadas.
      </p>
    );
  }
  return (
    <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
      {fotos.map((foto, i) => (
        <li key={foto.id}>
          <a
            href={foto.url}
            target="_blank"
            rel="noreferrer"
            className="block overflow-hidden rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Image
              src={foto.url}
              alt={`${descripcion}, foto ${i + 1} de ${fotos.length}`}
              width={foto.ancho ?? 400}
              height={foto.alto ?? 300}
              sizes="(min-width: 640px) 25vw, 33vw"
              className="aspect-square w-full object-cover transition-transform hover:scale-105"
            />
          </a>
        </li>
      ))}
    </ul>
  );
}
