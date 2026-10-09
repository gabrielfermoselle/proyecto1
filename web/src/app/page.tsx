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
    detalle: "Fleteros de tu zona te mandan su precio. Les preguntás por el chat.",
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

function VistaPrevia() {
  return (
    <figure className="relative">
      <div className="grid gap-4 rounded-2xl bg-secondary p-4 text-secondary-foreground shadow-xl ring-1 ring-inset ring-accent/40 sm:p-6">
        <div className="flex items-center justify-between gap-2 text-sm">
          <span className="font-semibold">Tu pedido</span>
          <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-xs font-semibold">Ejemplo</span>
        </div>
        <div className="grid gap-3 rounded-xl bg-card p-4 text-card-foreground">
          <div className="grid gap-0.5">
            <p className="font-heading text-lg font-extrabold leading-tight">Mudanza de 2 ambientes</p>
            <p className="text-sm text-muted-foreground">Centro → Yerba Buena · sábado, mañana · 6,2 km</p>
          </div>
          <ol aria-label="Estado del pedido de ejemplo" className="grid grid-cols-4 gap-1">
            {["Esperando", "Aceptado", "En camino", "Finalizado"].map((p, i) => (
              <li key={p} className="grid gap-1">
                <span className={cn("h-1.5 rounded-full", i === 0 ? "bg-primary" : "bg-border")} />
                <span
                  className={cn(
                    "text-[11px] font-semibold",
                    i === 0 ? "text-foreground" : "text-muted-foreground",
                  )}
                >
                  {p}
                </span>
              </li>
            ))}
          </ol>
        </div>
        <p className="text-sm font-semibold">3 presupuestos recibidos</p>
        <ul className="grid gap-2">
          {EJEMPLO.map((e) => (
            <li
              key={e.nombre}
              className="grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-xl bg-card p-3 text-card-foreground"
            >
              <span className="grid size-9 place-items-center rounded-full bg-secondary font-heading font-extrabold text-secondary-foreground">
                {e.nombre.charAt(0)}
              </span>
              <span className="grid min-w-0">
                <span className="flex items-center gap-1.5 truncate font-semibold">
                  {e.nombre}
                  {e.verificado ? (
                    <BadgeCheck className="size-4 text-success" aria-label="verificado" />
                  ) : null}
                </span>
                <span className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                  <Star className="size-3.5 fill-accent text-accent" aria-hidden="true" />
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
      <figcaption className="mt-3 text-center text-sm text-muted-foreground">
        Así comparás: precio, calificación y vehículo, uno al lado del otro.
      </figcaption>
    </figure>
  );
}

export default async function InicioPage() {
  const usuario = await getUsuarioActual();
  const esCliente = usuario?.rol === "CLIENTE";
  const hrefPedir = esCliente ? "/cliente/nuevo" : "/registro?rol=cliente";

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="toldo bg-secondary text-secondary-foreground">
        <div className="container flex h-16 items-center justify-between gap-4">
          <Logo sobreToldo />
          <nav aria-label="Cuenta" className="flex items-center gap-2">
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
                  className="hover:bg-white/10 focus-visible:ring-accent focus-visible:ring-offset-0"
                >
                  <Link href="/login">Ingresar</Link>
                </Button>
                <Button asChild variant="accent" size="sm">
                  <Link href="/registro">Registrarse</Link>
                </Button>
              </>
            )}
          </nav>
        </div>
      </header>

      <main id="contenido" className="flex-1">
        <section
          aria-labelledby="titulo-inicio"
          className="container grid items-center gap-12 py-12 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:py-20"
        >
          <div className="grid gap-8">
            <div className="grid gap-4">
              <h1
                id="titulo-inicio"
                className="text-5xl font-extrabold leading-[1.02] tracking-tight sm:text-6xl xl:text-7xl"
              >
                ¿Qué necesitás <span className="text-primary">mover</span>?
              </h1>
              <p className="max-w-xl text-lg text-muted-foreground sm:text-xl">
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
                      className="group flex h-full flex-col items-start gap-3 rounded-xl border bg-card p-4 font-semibold shadow-sm transition-[border-color,box-shadow,transform] hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <span className="grid size-10 place-items-center rounded-lg bg-secondary text-secondary-foreground ring-1 ring-inset ring-accent/40">
                        <Icono className="size-5" aria-hidden="true" />
                      </span>
                      {etiqueta}
                    </Link>
                  </li>
                );
              })}
            </ul>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg" className="text-base">
                <Link href={hrefPedir}>
                  Pedir flete
                  <ArrowRight aria-hidden="true" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="text-base">
                <Link href={usuario?.rol === "FLETERO" ? "/fletero" : "/registro?rol=fletero"}>
                  <Truck aria-hidden="true" />
                  Soy fletero
                </Link>
              </Button>
            </div>
          </div>

          <VistaPrevia />
        </section>

        <section aria-labelledby="como-funciona" className="border-y bg-card">
          <div className="container grid gap-8 py-14">
            <h2 id="como-funciona" className="text-3xl font-extrabold">
              Cómo funciona
            </h2>
            <ol className="grid gap-6 md:grid-cols-3 md:gap-4">
              {PASOS.map((p, i) => (
                <li key={p.titulo} className="relative flex gap-4 md:flex-col">
                  <div className="flex items-center gap-3 md:w-full">
                    <span className="grid size-12 shrink-0 place-items-center rounded-full bg-primary font-heading text-xl font-extrabold text-primary-foreground ring-4 ring-primary/15">
                      {i + 1}
                    </span>
                    {i < PASOS.length - 1 ? (
                      <span
                        aria-hidden="true"
                        className="hidden h-px flex-1 bg-gradient-to-r from-primary/40 to-transparent md:block"
                      />
                    ) : null}
                  </div>
                  <div className="grid gap-1">
                    <h3 className="text-xl font-bold">{p.titulo}</h3>
                    <p className="max-w-xs text-muted-foreground">{p.detalle}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section aria-labelledby="para-fleteros" className="bg-primary text-primary-foreground">
          <div className="container grid items-center gap-6 py-14 md:grid-cols-[1fr_auto]">
            <div className="grid gap-3">
              <h2 id="para-fleteros" className="text-3xl font-extrabold">
                ¿Tenés moto, auto, camioneta o camión?
              </h2>
              <p className="max-w-2xl text-lg text-primary-foreground/85">
                Mirá los pedidos cerca de tu base, con fotos y medidas, y presupuestá los que te convienen. El
                chat con el cliente se abre cuando le mandás tu precio.
              </p>
              <p className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-primary-foreground/85">
                <span className="inline-flex items-center gap-1.5">
                  <BadgeCheck className="size-4" aria-hidden="true" />
                  Insignia de verificado
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <MessagesSquare className="size-4" aria-hidden="true" />
                  Chat por pedido
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Star className="size-4" aria-hidden="true" />
                  Reseñas de clientes reales
                </span>
              </p>
            </div>
            <Button
              asChild
              size="lg"
              variant="accent"
              className="text-base focus-visible:ring-offset-primary"
            >
              <Link href={usuario?.rol === "FLETERO" ? "/fletero" : "/registro?rol=fletero"}>
                Quiero ser fletero
                <ArrowRight aria-hidden="true" />
              </Link>
            </Button>
          </div>
        </section>
      </main>

      <footer className="container flex flex-wrap items-center justify-between gap-2 py-6 text-sm text-muted-foreground">
        <p>Fletes Tucumán · San Miguel de Tucumán y alrededores</p>
        <p>Pagos: se arreglan directamente con el fletero.</p>
      </footer>
    </div>
  );
}
