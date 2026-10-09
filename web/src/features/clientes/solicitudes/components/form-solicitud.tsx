"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, ArrowRight, Camera, Check, Minus, Plus, Route, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useRef, useState } from "react";
import { useFieldArray, useForm, type FieldPath, type UseFormReturn } from "react-hook-form";
import { FormField, SelectField, TextareaField } from "@/components/shared/form-field";
import { FormMensaje } from "@/components/shared/form-mensaje";
import { RadioCard } from "@/components/shared/radio-card";
import { SubmitButton } from "@/components/shared/submit-button";
import { iconoTipoFlete } from "@/components/shared/tipo-flete-icono";
import { Button } from "@/components/ui/button";
import {
  AYUDA_TIPO_FLETE,
  ESTADOS_INICIALES_ITEM,
  ETIQUETA_ESTADO_INICIAL,
  ETIQUETA_TIPO_FLETE,
  ETIQUETA_VEHICULO,
  FRANJA,
  FRANJAS_HORARIAS,
  TIPOS_FLETE,
  TIPOS_VEHICULO,
} from "@/domain/catalogos";
import { resumirCarga, type ItemCarga } from "@/domain/carga";
import { fechaIsoAr, sumarDias } from "@/domain/fechas";
import { haversineKm, type Coordenadas } from "@/domain/geo";
import { DIAS_MAXIMOS_ANTICIPACION, MAXIMO_ITEMS } from "@/domain/solicitud";
import { hrefPedido } from "@/features/fletes/rutas";
import { AddressAutocomplete } from "@/features/mapas/components/address-autocomplete";
import { MapaPunto } from "@/features/mapas/components/mapas-dinamicos";
import { direccionDePunto } from "@/features/mapas/geocoding";
import { formatearDia, formatearKg, formatearKm, formatearM3 } from "@/lib/formato";
import { useEnvio } from "@/lib/use-envio";
import { cn } from "@/lib/utils";
import { crearSolicitud } from "../actions";
import { solicitudSchema, type SolicitudDatos, type SolicitudInput } from "../schemas";

type Formulario = UseFormReturn<SolicitudInput, unknown, SolicitudDatos>;
type Campo = FieldPath<SolicitudInput>;

const ITEM_VACIO = {
  nombre: "",
  cantidad: 1,
  largoCm: "",
  anchoCm: "",
  altoCm: "",
  pesoKgAprox: "",
  fragil: false,
  estadoInicial: "BUENO",
  notas: "",
} satisfies SolicitudInput["items"][number];

/** Los cinco pasos del pedido y los campos que valida cada uno antes de seguir. */
const PASOS = [
  { titulo: "Tipo", ayuda: "¿Qué tenés que mover?", campos: ["tipoFlete"] },
  {
    titulo: "Origen y destino",
    ayuda: "Dónde lo retiran y dónde lo dejan.",
    campos: [
      "origenDireccion",
      "origenLat",
      "origenLng",
      "origenPiso",
      "destinoDireccion",
      "destinoLat",
      "destinoLng",
      "destinoPiso",
    ],
  },
  {
    titulo: "Qué llevás",
    ayuda: "Con las medidas aproximadas te pasan un precio más justo.",
    campos: ["titulo", "descripcion", "items"],
  },
  { titulo: "Fecha y horario", ayuda: "Cuándo lo necesitás.", campos: ["fecha", "franja"] },
  {
    titulo: "Extras",
    ayuda: "Ayuda para cargar y embalaje.",
    campos: ["ayudantesRequeridos", "requiereEmbalaje", "tipoVehiculoSugerido"],
  },
] as const satisfies readonly { titulo: string; ayuda: string; campos: readonly Campo[] }[];

/** Dirección + punto en el mapa + piso y ascensor, para el origen o el destino. */
function Lugar({ form, prefijo }: { form: Formulario; prefijo: "origen" | "destino" }) {
  const { register, setValue, getValues, formState } = form;
  const campo = <S extends string>(sufijo: S) => `${prefijo}${sufijo}` as `${typeof prefijo}${S}`;
  const lat = getValues(campo("Lat"));
  const lng = getValues(campo("Lng"));
  const [punto, setPunto] = useState<Coordenadas | null>(
    typeof lat === "number" && typeof lng === "number" ? { lat, lng } : null,
  );
  const inversa = useRef<AbortController | null>(null);

  const fijar = useCallback(
    (nuevo: Coordenadas, direccion?: string) => {
      setPunto(nuevo);
      setValue(campo("Lat"), nuevo.lat);
      setValue(campo("Lng"), nuevo.lng);
      if (direccion) {
        setValue(campo("Direccion"), direccion, { shouldValidate: true });
        return;
      }
      // Pin movido a mano: se busca la dirección más cercana.
      inversa.current?.abort();
      const controlador = new AbortController();
      inversa.current = controlador;
      direccionDePunto(nuevo, controlador.signal)
        .then((d) => d && setValue(campo("Direccion"), d, { shouldValidate: true }))
        .catch(() => undefined);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `campo` depende solo de `prefijo`
    [setValue, prefijo],
  );

  const errores = formState.errors;
  const errorDireccion = errores[campo("Direccion")]?.message;
  const esOrigen = prefijo === "origen";
  return (
    <fieldset className="grid content-start gap-3">
      <legend className="mb-1 flex items-center gap-2 text-lg font-bold">
        <span
          aria-hidden="true"
          className={cn("size-3 rounded-full", esOrigen ? "bg-primary" : "bg-accent")}
        />
        {esOrigen ? "Desde dónde" : "Hasta dónde"}
      </legend>
      <AddressAutocomplete
        label={esOrigen ? "Buscá la dirección de retiro" : "Buscá la dirección de entrega"}
        placeholder="Ej.: Av. Mate de Luna 2400"
        onSelect={({ lat, lng, direccion }) => fijar({ lat, lng }, direccion)}
      />
      <MapaPunto
        punto={punto}
        onMover={fijar}
        variante={esOrigen ? "origen" : "destino"}
        etiqueta={`Mapa para marcar el punto de ${esOrigen ? "retiro" : "entrega"}`}
      />
      <FormField
        label="Dirección"
        hint="El fletero ve solo la calle y el barrio hasta que aceptes su presupuesto."
        error={errorDireccion}
        {...register(campo("Direccion"))}
      />
      <div className="grid grid-cols-2 gap-3">
        <FormField
          label="Piso"
          type="number"
          inputMode="numeric"
          min={0}
          max={60}
          placeholder="PB"
          error={errores[campo("Piso")]?.message}
          {...register(campo("Piso"))}
        />
        <label className="flex items-center gap-3 self-end rounded-md border bg-card px-3 py-2.5 font-semibold">
          <input
            type="checkbox"
            className="size-5 accent-[hsl(var(--primary))]"
            {...register(campo("Ascensor"))}
          />
          Hay ascensor
        </label>
      </div>
    </fieldset>
  );
}

function resumenCarga(items: SolicitudInput["items"]) {
  try {
    return resumirCarga(
      items.map((i): ItemCarga => {
        const n = (v: unknown) => (v === "" || v === null || v === undefined ? null : Number(v));
        return {
          cantidad: Math.max(1, Math.trunc(Number(i.cantidad) || 1)),
          largoCm: n(i.largoCm),
          anchoCm: n(i.anchoCm),
          altoCm: n(i.altoCm),
          pesoKgAprox: n(i.pesoKgAprox),
        };
      }),
    );
  } catch {
    return null;
  }
}

function ResumenCargaVivo({ items }: { items: SolicitudInput["items"] }) {
  const resumen = resumenCarga(items);
  if (!resumen) return null;
  return (
    <p className="rounded-lg bg-muted/60 px-3 py-2 text-sm" aria-live="polite">
      <strong>{resumen.cantidadBultos}</strong> {resumen.cantidadBultos === 1 ? "bulto" : "bultos"} ·{" "}
      {formatearKg(resumen.pesoTotalKg)} · {formatearM3(resumen.volumenTotalM3)}
      {resumen.itemsSinMedidas ? (
        <span className="text-muted-foreground">
          {" "}
          · {resumen.itemsSinMedidas} {resumen.itemsSinMedidas === 1 ? "ítem" : "ítems"} sin medidas o peso
        </span>
      ) : null}
    </p>
  );
}

function DistanciaCalculada({ form }: { form: Formulario }) {
  const [oLat, oLng, dLat, dLng] = form.watch(["origenLat", "origenLng", "destinoLat", "destinoLng"]);
  if (
    typeof oLat !== "number" ||
    typeof oLng !== "number" ||
    typeof dLat !== "number" ||
    typeof dLng !== "number"
  )
    return null;
  const km = haversineKm({ lat: oLat, lng: oLng }, { lat: dLat, lng: dLng });
  return (
    <p
      className="flex items-center gap-3 rounded-lg bg-secondary px-4 py-3 text-secondary-foreground"
      aria-live="polite"
    >
      <Route className="size-5 shrink-0 text-accent" aria-hidden="true" />
      <span>
        Distancia en línea recta: <strong className="font-heading text-lg">{formatearKm(km)}</strong>
      </span>
    </p>
  );
}

/** Pasos a la izquierda (escritorio) o barra de progreso (celular). */
function IndicePasos({
  actual,
  alcanzado,
  irA,
}: {
  actual: number;
  alcanzado: number;
  irA: (paso: number) => void;
}) {
  return (
    <>
      <div className="grid gap-2 lg:hidden">
        <p className="text-sm font-semibold" aria-live="polite">
          <span className="text-muted-foreground">
            Paso {actual + 1} de {PASOS.length}:{" "}
          </span>
          {PASOS[actual]!.titulo}
        </p>
        <span aria-hidden="true" className="grid grid-cols-5 gap-1">
          {PASOS.map((p, i) => (
            <span
              key={p.titulo}
              className={cn(
                "h-1.5 rounded-full",
                i < actual ? "bg-success" : i === actual ? "bg-primary" : "bg-border",
              )}
            />
          ))}
        </span>
      </div>
      <nav aria-label="Pasos del pedido" className="hidden lg:block">
        <ol className="grid gap-1">
          {PASOS.map((p, i) => {
            const hecho = i < actual;
            const disponible = i <= alcanzado;
            return (
              <li key={p.titulo}>
                <button
                  type="button"
                  disabled={!disponible}
                  aria-current={i === actual ? "step" : undefined}
                  onClick={() => irA(i)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    i === actual ? "bg-card shadow-sm" : disponible ? "hover:bg-card/60" : "cursor-default",
                  )}
                >
                  <span
                    className={cn(
                      "grid size-8 shrink-0 place-items-center rounded-full font-heading text-sm font-extrabold",
                      hecho && "bg-success text-success-foreground",
                      i === actual && "bg-primary text-primary-foreground",
                      !hecho && i !== actual && "border-2 border-border text-muted-foreground",
                    )}
                  >
                    {hecho ? <Check className="size-4 stroke-[3]" aria-hidden="true" /> : i + 1}
                  </span>
                  <span className="grid">
                    <span className={cn("font-semibold", !disponible && "text-muted-foreground")}>
                      {p.titulo}
                    </span>
                    <span className="text-xs text-muted-foreground">{p.ayuda}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </nav>
    </>
  );
}

function FilaResumen({ etiqueta, children }: { etiqueta: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-0.5 sm:grid-cols-[9rem_1fr] sm:gap-3">
      <dt className="text-sm text-muted-foreground">{etiqueta}</dt>
      <dd className="min-w-0 font-semibold">{children}</dd>
    </div>
  );
}

export function FormSolicitud() {
  const router = useRouter();
  const hoy = fechaIsoAr();
  const [paso, setPaso] = useState(0);
  const [alcanzado, setAlcanzado] = useState(0);
  const encabezado = useRef<HTMLHeadingElement>(null);
  const form = useForm<SolicitudInput, unknown, SolicitudDatos>({
    resolver: zodResolver(solicitudSchema),
    defaultValues: {
      titulo: "",
      descripcion: "",
      fecha: sumarDias(hoy, 1),
      franja: "MANANA",
      ayudantesRequeridos: 0,
      requiereEmbalaje: false,
      tipoVehiculoSugerido: "",
      origenDireccion: "",
      destinoDireccion: "",
      origenPiso: "",
      destinoPiso: "",
      origenAscensor: false,
      destinoAscensor: false,
      items: [ITEM_VACIO],
    },
  });
  const { register, control, handleSubmit, getValues, setValue, watch, trigger, setError, formState } = form;
  const { errors, isSubmitting } = formState;
  const { fields, append, remove } = useFieldArray({ control, name: "items" });
  const { mensaje, enviar } = useEnvio(setError);
  const tipoFlete = watch("tipoFlete");
  const franja = watch("franja");
  const items = watch("items");
  const ayudantes = Number(watch("ayudantesRequeridos")) || 0;
  const ultimo = paso === PASOS.length - 1;

  function irA(siguiente: number) {
    setPaso(siguiente);
    setAlcanzado((a) => Math.max(a, siguiente));
    // El foco va al título del paso: el lector de pantalla anuncia dónde está.
    requestAnimationFrame(() => {
      encabezado.current?.focus({ preventScroll: true });
      encabezado.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  async function avanzar() {
    if (await trigger([...PASOS[paso]!.campos])) irA(paso + 1);
  }

  const onSubmit = handleSubmit(
    async () => {
      const resultado = await enviar(() => crearSolicitud(getValues()));
      if (resultado) router.push(`${hrefPedido("CLIENTE", resultado.data.id)}?nueva=1`);
    },
    // Si algo quedó mal en un paso anterior (p. ej. una dirección fuera de Tucumán), se vuelve ahí.
    (errores) => {
      const conError = PASOS.findIndex((p) => p.campos.some((c) => c in errores));
      if (conError >= 0 && conError !== paso) irA(conError);
    },
  );

  const carga = resumenCarga(items);
  const [origen, destino, fecha] = watch(["origenDireccion", "destinoDireccion", "fecha"]);

  return (
    <form
      onSubmit={(e) => {
        // Enter en un campo avanza de paso en lugar de publicar a medio completar.
        if (!ultimo) {
          e.preventDefault();
          void avanzar();
          return;
        }
        void onSubmit(e);
      }}
      noValidate
      className="grid items-start gap-6 lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-10"
    >
      <div className="lg:sticky lg:top-24">
        <IndicePasos actual={paso} alcanzado={alcanzado} irA={irA} />
      </div>

      <div className="grid gap-5">
        <FormMensaje mensaje={mensaje} />
        <section
          aria-labelledby="titulo-paso"
          className="grid gap-5 rounded-xl border bg-card p-5 shadow-sm sm:p-7"
        >
          <header className="grid gap-1">
            <h2
              id="titulo-paso"
              ref={encabezado}
              tabIndex={-1}
              className="scroll-mt-24 text-2xl font-extrabold focus:outline-none"
            >
              {paso + 1}. {PASOS[paso]!.titulo}
            </h2>
            <p className="text-muted-foreground">{PASOS[paso]!.ayuda}</p>
          </header>

          {paso === 0 ? (
            <fieldset className="grid gap-3">
              <legend className="sr-only">Tipo de flete</legend>
              <div className="grid gap-3 sm:grid-cols-2">
                {TIPOS_FLETE.map((t) => {
                  const Icono = iconoTipoFlete(t);
                  return (
                    <RadioCard
                      key={t}
                      value={t}
                      checked={tipoFlete === t}
                      icon={<Icono />}
                      title={ETIQUETA_TIPO_FLETE[t]}
                      description={AYUDA_TIPO_FLETE[t]}
                      className="items-center p-4"
                      {...register("tipoFlete", {
                        // Elegir el tipo ya alcanza para seguir.
                        onChange: () => void avanzar(),
                      })}
                    />
                  );
                })}
              </div>
              {errors.tipoFlete ? (
                <p className="text-sm font-medium text-destructive">{errors.tipoFlete.message}</p>
              ) : null}
            </fieldset>
          ) : null}

          {paso === 1 ? (
            <>
              <div className="grid gap-8 xl:grid-cols-2 xl:gap-6">
                <Lugar form={form} prefijo="origen" />
                <Lugar form={form} prefijo="destino" />
              </div>
              <DistanciaCalculada form={form} />
            </>
          ) : null}

          {paso === 2 ? (
            <>
              <FormField
                label="Título"
                placeholder="Ej.: Mudanza de 2 ambientes"
                hint="Es lo primero que ven los fleteros."
                error={errors.titulo?.message}
                {...register("titulo")}
              />
              <TextareaField
                label="Descripción (opcional)"
                rows={3}
                placeholder="Ej.: La heladera es de dos puertas. Hay que bajarla por escalera."
                error={errors.descripcion?.message}
                {...register("descripcion")}
              />
              <fieldset className="grid gap-3">
                <legend className="mb-1 font-semibold">
                  Lista de cosas{" "}
                  <span className="font-normal text-muted-foreground">
                    (es el inventario que se controla al cargar y al entregar)
                  </span>
                </legend>
                <ol className="grid gap-3">
                  {fields.map((campo, i) => {
                    const e = errors.items?.[i];
                    return (
                      <li key={campo.id} className="grid gap-3 rounded-lg border bg-background/60 p-3 sm:p-4">
                        <div className="flex items-start gap-2">
                          <span className="mt-9 w-6 font-heading text-lg font-extrabold text-muted-foreground">
                            {i + 1}.
                          </span>
                          <div className="grid flex-1 gap-3 sm:grid-cols-[1fr_7rem]">
                            <FormField
                              label="Qué es"
                              placeholder="Ej.: Heladera"
                              error={e?.nombre?.message}
                              {...register(`items.${i}.nombre`)}
                            />
                            <FormField
                              label="Cantidad"
                              type="number"
                              inputMode="numeric"
                              min={1}
                              error={e?.cantidad?.message}
                              {...register(`items.${i}.cantidad`)}
                            />
                          </div>
                          {fields.length > 1 ? (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="mt-7"
                              onClick={() => remove(i)}
                            >
                              <Trash2 aria-hidden="true" />
                              <span className="sr-only">Quitar el ítem {i + 1}</span>
                            </Button>
                          ) : null}
                        </div>
                        <details className="group grid gap-3 sm:pl-8">
                          <summary className="cursor-pointer list-none text-sm font-semibold text-primary underline-offset-4 hover:underline [&::-webkit-details-marker]:hidden">
                            <span className="group-open:hidden">+ Tamaño aproximado, peso y estado</span>
                            <span className="hidden group-open:inline">− Ocultar tamaño, peso y estado</span>
                          </summary>
                          <div className="mt-3 grid gap-3">
                            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                              <FormField
                                label="Largo (cm)"
                                type="number"
                                inputMode="numeric"
                                error={e?.largoCm?.message}
                                {...register(`items.${i}.largoCm`)}
                              />
                              <FormField
                                label="Ancho (cm)"
                                type="number"
                                inputMode="numeric"
                                error={e?.anchoCm?.message}
                                {...register(`items.${i}.anchoCm`)}
                              />
                              <FormField
                                label="Alto (cm)"
                                type="number"
                                inputMode="numeric"
                                error={e?.altoCm?.message}
                                {...register(`items.${i}.altoCm`)}
                              />
                              <FormField
                                label="Peso aprox. (kg)"
                                type="number"
                                inputMode="decimal"
                                step="0.1"
                                error={e?.pesoKgAprox?.message}
                                {...register(`items.${i}.pesoKgAprox`)}
                              />
                            </div>
                            <div className="grid gap-3 sm:grid-cols-2">
                              <SelectField
                                label="Estado actual"
                                hint="Si ya tiene marcas, el fletero lo confirma al cargar."
                                {...register(`items.${i}.estadoInicial`)}
                              >
                                {ESTADOS_INICIALES_ITEM.map((estado) => (
                                  <option key={estado} value={estado}>
                                    {ETIQUETA_ESTADO_INICIAL[estado]}
                                  </option>
                                ))}
                              </SelectField>
                              <label className="flex items-center gap-3 self-start rounded-md border bg-card px-3 py-2.5 font-semibold sm:mt-7">
                                <input
                                  type="checkbox"
                                  className="size-5 accent-[hsl(var(--primary))]"
                                  {...register(`items.${i}.fragil`)}
                                />
                                Es frágil
                              </label>
                            </div>
                            <FormField
                              label="Notas (opcional)"
                              placeholder="Ej.: Tiene una puerta de vidrio"
                              error={e?.notas?.message}
                              {...register(`items.${i}.notas`)}
                            />
                          </div>
                        </details>
                      </li>
                    );
                  })}
                </ol>
                {errors.items?.message ? (
                  <p className="text-sm font-medium text-destructive">{errors.items.message}</p>
                ) : null}
                {fields.length < MAXIMO_ITEMS ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="justify-self-start"
                    onClick={() => append(ITEM_VACIO)}
                  >
                    <Plus aria-hidden="true" />
                    Agregar otra cosa
                  </Button>
                ) : null}
                <ResumenCargaVivo items={items} />
              </fieldset>
              <p className="flex items-start gap-3 rounded-lg border border-dashed p-3 text-sm">
                <Camera className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
                <span>
                  <strong>Fotos:</strong> apenas publiques, te pedimos fotos de lo que hay que llevar. Con
                  ellas los fleteros te presupuestan sin tener que llamarte.
                </span>
              </p>
            </>
          ) : null}

          {paso === 3 ? (
            <>
              <FormField
                label="Día"
                type="date"
                min={hoy}
                max={sumarDias(hoy, DIAS_MAXIMOS_ANTICIPACION)}
                error={errors.fecha?.message}
                className="max-w-xs"
                {...register("fecha")}
              />
              <fieldset className="grid gap-2">
                <legend className="mb-1 text-sm font-semibold">Franja horaria</legend>
                <div className="grid gap-2 sm:grid-cols-2">
                  {FRANJAS_HORARIAS.map((f) => (
                    <RadioCard
                      key={f}
                      value={f}
                      checked={franja === f}
                      title={FRANJA[f].etiqueta}
                      className="p-3"
                      {...register("franja")}
                    />
                  ))}
                </div>
              </fieldset>
            </>
          ) : null}

          {paso === 4 ? (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <fieldset className="grid content-start gap-2 rounded-lg border p-4">
                  <legend className="px-1 font-semibold">Ayudantes</legend>
                  <p className="text-sm text-muted-foreground">Personas que cargan además del fletero.</p>
                  <div className="flex items-center gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      disabled={ayudantes === 0}
                      onClick={() => setValue("ayudantesRequeridos", Math.max(0, ayudantes - 1))}
                    >
                      <Minus aria-hidden="true" />
                      <span className="sr-only">Quitar un ayudante</span>
                    </Button>
                    <output
                      aria-live="polite"
                      className="min-w-8 text-center font-heading text-3xl font-extrabold tabular-nums"
                    >
                      {ayudantes}
                    </output>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      disabled={ayudantes >= 10}
                      onClick={() => setValue("ayudantesRequeridos", Math.min(10, ayudantes + 1))}
                    >
                      <Plus aria-hidden="true" />
                      <span className="sr-only">Sumar un ayudante</span>
                    </Button>
                  </div>
                  <input type="hidden" {...register("ayudantesRequeridos")} />
                </fieldset>
                <RadioCard
                  type="checkbox"
                  title="Embalaje"
                  description="Que el fletero traiga mantas, film o cajas para proteger tus cosas."
                  className="p-4"
                  {...register("requiereEmbalaje")}
                />
              </div>
              <SelectField
                label="Vehículo que creés que hace falta (opcional)"
                {...register("tipoVehiculoSugerido")}
              >
                <option value="">No sé, que lo decida el fletero</option>
                {TIPOS_VEHICULO.map((t) => (
                  <option key={t} value={t}>
                    {ETIQUETA_VEHICULO[t]}
                  </option>
                ))}
              </SelectField>

              <div className="grid gap-3 rounded-lg bg-muted/50 p-4">
                <h3 className="font-bold">Antes de publicar, revisá</h3>
                <dl className="grid gap-2">
                  <FilaResumen etiqueta="Tipo">
                    {tipoFlete ? ETIQUETA_TIPO_FLETE[tipoFlete] : "—"}
                  </FilaResumen>
                  <FilaResumen etiqueta="Retiro">
                    <span className="block truncate">{origen || "—"}</span>
                  </FilaResumen>
                  <FilaResumen etiqueta="Entrega">
                    <span className="block truncate">{destino || "—"}</span>
                  </FilaResumen>
                  <FilaResumen etiqueta="Cuándo">
                    {fecha ? `${formatearDia(fecha, { largo: true })} · ${FRANJA[franja].etiqueta}` : "—"}
                  </FilaResumen>
                  <FilaResumen etiqueta="Carga">
                    {carga
                      ? `${carga.cantidadBultos} ${carga.cantidadBultos === 1 ? "bulto" : "bultos"} · ${formatearKg(carga.pesoTotalKg)}`
                      : "—"}
                  </FilaResumen>
                </dl>
                <p className="text-sm text-muted-foreground">
                  Tu teléfono y la dirección exacta no se muestran hasta que aceptes un presupuesto.
                </p>
              </div>
            </>
          ) : null}
        </section>

        <div className="sticky bottom-20 z-10 flex items-center justify-between gap-3 rounded-xl border bg-card/95 p-3 shadow-lg backdrop-blur supports-[backdrop-filter]:bg-card/85 lg:static lg:border-0 lg:bg-transparent lg:p-0 lg:shadow-none lg:backdrop-blur-none">
          {paso > 0 ? (
            <Button type="button" variant="ghost" onClick={() => irA(paso - 1)}>
              <ArrowLeft aria-hidden="true" />
              Atrás
            </Button>
          ) : (
            <span />
          )}
          {ultimo ? (
            <SubmitButton pending={isSubmitting} pendingLabel="Publicando…" size="lg">
              Publicar pedido
            </SubmitButton>
          ) : (
            <Button type="button" size="lg" onClick={() => void avanzar()}>
              Siguiente
              <ArrowRight aria-hidden="true" />
            </Button>
          )}
        </div>
      </div>
    </form>
  );
}
