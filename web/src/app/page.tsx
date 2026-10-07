import { ClipboardList, MapPin, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { Logo } from "@/components/shared/logo";
import { Button } from "@/components/ui/button";

const PASOS = [
  {
    Icono: ClipboardList,
    titulo: "Contá qué querés llevar",
    detalle: "Origen, destino, fecha y la lista de cosas, con medidas y fotos.",
  },
  {
    Icono: MapPin,
    titulo: "Recibí presupuestos de fleteros cercanos",
    detalle: "Motos, autos, camionetas y camiones que trabajan en tu zona.",
  },
  {
    Icono: ShieldCheck,
    titulo: "Elegí y seguí tu flete",
    detalle: "Compará precio, vehículo y reseñas. Confirmás cuando llega todo.",
  },
];

export default function InicioPage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="container flex h-16 items-center justify-between gap-4">
        <Logo />
        <Button asChild variant="ghost" size="sm">
          <Link href="/login">Ingresar</Link>
        </Button>
      </header>

      <main id="contenido" className="container flex-1 pb-16">
        <section className="max-w-2xl py-10 sm:py-16">
          <h1 className="text-4xl font-extrabold leading-[1.1] sm:text-5xl">
            Tu flete en Tucumán, al precio que vos elegís.
          </h1>
          <p className="mt-4 text-lg text-muted-foreground">
            Publicá lo que necesitás trasladar y compará presupuestos de fleteros del Gran San Miguel de
            Tucumán.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg">
              <Link href="/registro?rol=cliente">Necesito un flete</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/registro?rol=fletero">Soy fletero</Link>
            </Button>
          </div>
        </section>

        <section aria-labelledby="como-funciona" className="border-t pt-10">
          <h2 id="como-funciona" className="text-2xl font-bold">
            Cómo funciona
          </h2>
          <ol className="mt-6 grid gap-6 sm:grid-cols-3">
            {PASOS.map(({ Icono, titulo, detalle }, i) => (
              <li key={titulo} className="flex gap-4 sm:flex-col sm:gap-3">
                <span className="grid size-11 shrink-0 place-items-center rounded-md bg-secondary text-secondary-foreground">
                  <Icono className="size-5" aria-hidden="true" />
                </span>
                <div>
                  <h3 className="font-bold">
                    <span className="sr-only">Paso {i + 1}: </span>
                    {titulo}
                  </h3>
                  <p className="mt-1 text-muted-foreground">{detalle}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>
      </main>
    </div>
  );
}
