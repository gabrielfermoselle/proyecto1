import { ArrowRight, BadgeCheck, MessagesSquare, Star, Truck } from "lucide-react";
import Link from "next/link";
import { Logo } from "@/components/shared/logo";
import { iconoTipoFlete } from "@/components/shared/tipo-flete-icono";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { TipoFlete } from "@/domain/catalogos";
import { AREA_POR_ROL } from "@/domain/roles";
import { getUsuarioActual } from "@/lib/session";
import { cn } from "@/lib/utils";

const TIPOS: { tipo: TipoFlete; etiqueta: string }[] = [
  { tipo: "MUDANZA", etiqueta: "Mudanza" },
  { tipo: "MUEBLES", etiqueta: "Mueble suelto" },
  { tipo: "COMPRAS", etiqueta: "Materiales" },
  { tipo: "OTRO", etiqueta: "Otro" },
];

const PASOS = [
  { titulo: "Publicás", detalle: "Qué llevás, de dónde a dónde y cuándo. Con fotos, mejor." },
  {
    titulo: "Recibís presupuestos",
    detalle: "Fleteros de tu zona te mandan su precio. Al aceptar uno, se abre el chat.",
  },
  { titulo: "Elegís", detalle: "Comparás precio, vehículo y reseñas. Seguís el flete hasta que llega." },
];

/** Presupuestos de muestra para la vista previa (datos inventados, marcados como ejemplo). */
const EJEMPLO = [
  {
    nombre: "Juan P.",
    rating: "4,8",
    reseñas: 32,
    vehiculo: "Camioneta",
    precio: "$45.000",
    verificado: true,
    marca: "Más barato",
  },
  {
    nombre: "Marta R.",
    rating: "4,9",
    reseñas: 57,
    vehiculo: "Camión chico",
    precio: "$52.000",
    verificado: true,
    marca: "Mejor calificada",
  },
  {
    nombre: "Diego S.",
    rating: "4,5",
    reseñas: 9,
    vehiculo: "Camioneta",
    precio: "$48.500",
    verificado: false,
    marca: null,
  },
];

/** Origen y destino unidos por la ruta punteada: el gesto de la marca. */
function Ruta({ origen, destino, className }: { origen: string; destino: string; className?: string }) {
  return (
    <div className={cn("grid grid-cols-[auto_1fr_auto] items-center gap-2 text-sm font-semibold", className)}>
      <span className="flex items-center gap-1.5">
        <span className="size-2.5 rounded-full bg-primary ring-4 ring-primary/15" aria-hidden="true" />
        {origen}
      </span>
      <span className="ruta-punteada h-0.5 text-input/70" aria-hidden="true" />
      <span className="flex items-center gap-1.5">
        {destino}
        <span className="size-2.5 rounded-full bg-accent ring-4 ring-accent/15" aria-hidden="true" />
      </span>
    </div>
  );
}

/** La hoja de ruta de un pedido de ejemplo: lo que el cliente ve cuando le llegan presupuestos. */
function VistaPrevia() {
  return (
    <figure className="relative">
      <div className="grid gap-5 rounded-2xl bg-card p-5 text-card-foreground shadow-xl sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="grid gap-1">
            <p className="font-heading text-xl font-extrabold leading-tight">Mudanza de 2 ambientes</p>
            <p className="text-sm text-muted-foreground">sábado, mañana · 6,2 km</p>
          </div>
          <Badge variant="muted">Ejemplo</Badge>
        </div>
        <Ruta origen="Centro" destino="Yerba Buena" />
        <ol aria-label="Estado del pedido de ejemplo" className="grid grid-cols-4 gap-1.5">
          {["Esperando", "Aceptado", "En camino", "Finalizado"].map((p, i) => (
            <li key={p} className="grid gap-1.5">
              <span className={cn("h-1.5 rounded-full", i === 0 ? "bg-primary" : "bg-border")} />
              <span
                className={cn("text-[11px] font-semibold", i === 0 ? "text-primary" : "text-muted-foreground")}
              >
                {p}
              </span>
            </li>
          ))}
        </ol>
        <div className="grid gap-2 border-t pt-4">
          <p className="text-sm font-semibold">3 presupuestos recibidos</p>
          <ul className="grid gap-2">
            {EJEMPLO.map((e, i) => (
              <li
                key={e.nombre}
                className={cn(
                  "grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-xl border p-3",
                  i === 0 && "border-primary/30 bg-primary-soft/50",
                )}
              >
                <span className="grid size-9 place-items-center rounded-full bg-secondary font-heading font-extrabold text-secondary-foreground">
                  {e.nombre.charAt(0)}
                </span>
                <span className="grid min-w-0">
                  <span className="flex items-center gap-1.5 truncate font-semibold">
                    {e.nombre}
                    {e.verificado ? (
                      <BadgeCheck className="size-4 text-primary" aria-label="verificado" />
                    ) : null}
                  </span>
                  <span className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                    <Star className="size-3.5 fill-rating text-rating" aria-hidden="true" />
                    {e.rating} ({e.reseñas}) · {e.vehiculo}
                  </span>
                </span>
                <span className="grid justify-items-end gap-0.5">
                  <span className="font-heading text-lg font-extrabold tabular-nums">{e.precio}</span>
                  {e.marca ? (
                    <Badge variant={e.marca === "Más barato" ? "success" : "secondary"} className="text-[10px]">
                      {e.marca}
                    </Badge>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <figcaption className="mt-3 text-center text-sm text-secondary-muted">
        Así comparás: precio, calificación y vehículo, uno al lado del otro.
      </figcaption>
    </figure>
  );
}

export default async function InicioPage() {
  const usuario = await getUsuarioActual();
  const esCliente = usuario?.rol === "CLIENTE";
  const hrefPedir = esCliente ? "/cliente/nuevo" : "/registro?rol=cliente";
  const hrefFletero = usuario?.rol === "FLETERO" ? "/fletero" : "/registro?rol=fletero";

  return (
    <div className="flex min-h-dvh flex-col">
      {/* El encabezado y el hero comparten el azul marino: una sola franja de marca. */}
      <div className="bg-secondary text-secondary-foreground">
        <header>
          <div className="container flex h-16 items-center justify-between gap-2 sm:gap-4">
            <Logo sobreToldo compactoEnCelular />
            <nav aria-label="Cuenta" className="flex items-center gap-1 sm:gap-2">
              {usuario ? (
                <Button asChild variant="accent" size="sm">
                  <Link href={AREA_POR_ROL[usuario.rol]}>
                    Ir a mi panel
                    <ArrowRight aria-hidden="true" />
                  </Link>
                </Button>
              ) : (
                <>
                  <Button
                    asChild
                    variant="ghost"
                    size="sm"
                    className="px-2.5 hover:bg-white/10 focus-visible:ring-accent-on-dark focus-visible:ring-offset-0 sm:px-3"
                  >
                    <Link href="/login">Ingresar</Link>
                  </Button>
                  <Button asChild variant="accent" size="sm" className="px-2.5 sm:px-3">
                    <Link href="/registro">Registrarse</Link>
                  </Button>
                </>
              )}
            </nav>
          </div>
        </header>

        <section
          aria-labelledby="titulo-inicio"
          className="container grid items-center gap-12 pb-16 pt-10 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:pb-24 lg:pt-16"
        >
          <div className="grid gap-8">
            <div className="grid gap-5">
              <h1
                id="titulo-inicio"
                className="text-5xl font-extrabold leading-[1.02] tracking-tight sm:text-6xl xl:text-7xl"
              >
                ¿Qué necesitás <span className="text-accent-on-dark">mover</span>?
              </h1>
              <p className="max-w-xl text-lg text-secondary-muted sm:text-xl">
                Publicalo gratis y recibí presupuestos de fleteros del Gran San Miguel de Tucumán. Vos
                comparás y elegís.
              </p>
            </div>

            <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4" aria-label="Tipos de flete">
              {TIPOS.map(({ tipo, etiqueta }) => {
                const Icono = iconoTipoFlete(tipo);
                return (
                  <li key={tipo}>
                    <Link
                      href={hrefPedir}
                      className="group flex h-full flex-col items-start gap-3 rounded-xl bg-white/[0.07] p-4 font-semibold ring-1 ring-inset ring-white/15 transition-[background-color,box-shadow,transform] duration-200 ease-out hover:-translate-y-0.5 hover:bg-white/[0.12] hover:ring-accent-on-dark/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-on-dark"
                    >
                      <span className="grid size-10 place-items-center rounded-lg bg-white text-secondary transition-colors group-hover:bg-accent group-hover:text-accent-foreground">
                        <Icono className="size-5" aria-hidden="true" />
                      </span>
                      {etiqueta}
                    </Link>
                  </li>
                );
              })}
            </ul>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg" variant="accent" className="text-base">
                <Link href={hrefPedir}>
                  Pedir flete
                  <ArrowRight aria-hidden="true" />
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="ghost"
                className="text-base ring-1 ring-inset ring-white/40 hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-accent-on-dark focus-visible:ring-offset-0"
              >
                <Link href={hrefFletero}>
                  <Truck aria-hidden="true" />
                  Soy fletero
                </Link>
              </Button>
            </div>
          </div>

          <VistaPrevia />
        </section>
      </div>

      <main id="contenido" className="flex-1">
        <section aria-labelledby="como-funciona" className="bg-background">
          <div className="container grid gap-10 py-16 lg:py-20">
            <h2 id="como-funciona" className="text-3xl font-extrabold sm:text-4xl">
              Cómo funciona
            </h2>
            {/* Tres paradas de la misma ruta: el número es el orden en que pasan las cosas. */}
            <ol className="grid gap-8 md:grid-cols-3 md:gap-6">
              {PASOS.map((p, i) => (
                <li key={p.titulo} className="relative grid gap-4 md:content-start">
                  <div className="flex items-center gap-3">
                    <span
                      className={cn(
                        "grid size-12 shrink-0 place-items-center rounded-full font-heading text-xl font-extrabold",
                        i === PASOS.length - 1
                          ? "bg-accent text-accent-foreground"
                          : "bg-primary text-primary-foreground",
                      )}
                    >
                      {i + 1}
                    </span>
                    {i < PASOS.length - 1 ? (
                      <span aria-hidden="true" className="ruta-punteada hidden h-0.5 flex-1 text-primary/40 md:block" />
                    ) : null}
                  </div>
                  <div className="grid gap-1.5">
                    <h3 className="text-xl font-bold">{p.titulo}</h3>
                    <p className="max-w-xs text-muted-foreground">{p.detalle}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section aria-labelledby="para-fleteros" className="border-t bg-card">
          <div className="container grid items-center gap-8 py-16 md:grid-cols-[1fr_auto] lg:py-20">
            <div className="grid gap-4">
              <h2 id="para-fleteros" className="text-3xl font-extrabold sm:text-4xl">
                ¿Tenés moto, auto, camioneta o camión?
              </h2>
              <p className="max-w-2xl text-lg text-muted-foreground">
                Mirá los pedidos cerca de tu base, con fotos y medidas, y presupuestá los que te convienen. El
                chat con el cliente se abre cuando acepta tu precio.
              </p>
              <ul className="flex flex-wrap gap-2 pt-1 text-sm font-semibold">
                <li className="inline-flex items-center gap-1.5 rounded-full bg-primary-soft px-3 py-1.5 text-primary">
                  <BadgeCheck className="size-4" aria-hidden="true" />
                  Insignia de verificado
                </li>
                <li className="inline-flex items-center gap-1.5 rounded-full bg-primary-soft px-3 py-1.5 text-primary">
                  <MessagesSquare className="size-4" aria-hidden="true" />
                  Chat por pedido
                </li>
                <li className="inline-flex items-center gap-1.5 rounded-full bg-primary-soft px-3 py-1.5 text-primary">
                  <Star className="size-4" aria-hidden="true" />
                  Reseñas de clientes reales
                </li>
              </ul>
            </div>
            <Button asChild size="lg" className="text-base">
              <Link href={hrefFletero}>
                Quiero ser fletero
                <ArrowRight aria-hidden="true" />
              </Link>
            </Button>
          </div>
        </section>
      </main>

      <footer className="border-t bg-background">
        <div className="container flex flex-wrap items-center justify-between gap-2 py-6 text-sm text-muted-foreground">
          <p>Fletes Tucumán · San Miguel de Tucumán y alrededores</p>
          <p>Pagos: se arreglan directamente con el fletero.</p>
        </div>
      </footer>
    </div>
  );
}
