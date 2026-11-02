import { MapPinOff } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { BotonVolver } from "@/components/shared/boton-volver";
import { Logo } from "@/components/shared/logo";
import { PantallaError } from "@/components/shared/pantalla-error";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "No encontramos esa página" };

/** 404 de toda la app: una dirección que no existe, un pedido borrado o un link viejo. */
export default function NoEncontrada() {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="toldo bg-secondary text-secondary-foreground">
        <div className="container flex h-16 items-center">
          <Logo sobreToldo />
        </div>
      </header>
      <main id="contenido" className="container flex flex-1 items-center">
        <PantallaError
          icono={<MapPinOff />}
          codigo="404"
          titulo="No encontramos esa página"
          descripcion={
            <p>
              Puede que el link esté mal escrito, que el pedido ya no exista o que no tengas acceso a él.
            </p>
          }
          acciones={
            <>
              <Button asChild>
                <Link href="/">Ir al inicio</Link>
              </Button>
              <BotonVolver />
            </>
          }
        />
      </main>
    </div>
  );
}
