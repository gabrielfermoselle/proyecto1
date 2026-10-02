"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useRef, useState } from "react";
import { useFieldArray, useForm, type UseFormReturn } from "react-hook-form";
import { FormField, SelectField, TextareaField } from "@/components/shared/form-field";
import { FormMensaje } from "@/components/shared/form-mensaje";
import { RadioCard } from "@/components/shared/radio-card";
import { SubmitButton } from "@/components/shared/submit-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
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
import type { Coordenadas } from "@/domain/geo";
import { DIAS_MAXIMOS_ANTICIPACION, MAXIMO_ITEMS } from "@/domain/solicitud";
import { AddressAutocomplete } from "@/features/mapas/components/address-autocomplete";
import { MapaPunto } from "@/features/mapas/components/mapas-dinamicos";
import { direccionDePunto } from "@/features/mapas/geocoding";
import { formatearKg, formatearM3 } from "@/lib/formato";
import { useEnvio } from "@/lib/use-envio";
import { crearSolicitud } from "../actions";
import { solicitudSchema, type SolicitudDatos, type SolicitudInput } from "../schemas";

type Formulario = UseFormReturn<SolicitudInput, unknown, SolicitudDatos>;

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

function Seccion({ titulo, ayuda, children }: { titulo: string; ayuda?: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <h2 className="text-lg font-bold">{titulo}</h2>
        {ayuda ? <p className="text-sm text-muted-foreground">{ayuda}</p> : null}
      </CardHeader>
      <CardContent className="grid gap-4">{children}</CardContent>
    </Card>
  );
}

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
  return (
    <div className="grid gap-3">
      <AddressAutocomplete
        label={prefijo === "origen" ? "Buscá la dirección de retiro" : "Buscá la dirección de entrega"}
        placeholder="Ej.: Av. Mate de Luna 2400"
        onSelect={({ lat, lng, direccion }) => fijar({ lat, lng }, direccion)}
      />
      <MapaPunto
        punto={punto}
        onMover={fijar}
        variante={prefijo === "origen" ? "origen" : "destino"}
        etiqueta={`Mapa para marcar el punto de ${prefijo === "origen" ? "retiro" : "entrega"}`}
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
        <label className="flex items-center gap-3 self-end rounded-md border px-3 py-2.5 font-semibold">
          <input
            type="checkbox"
            className="size-5 accent-[hsl(var(--primary))]"
            {...register(campo("Ascensor"))}
          />
          Hay ascensor
        </label>
      </div>
    </div>
  );
}

function ResumenCargaVivo({ items }: { items: SolicitudInput["items"] }) {
  let resumen = null;
  try {
    resumen = resumirCarga(
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
  return (
    <p className="rounded-md bg-muted/50 px-3 py-2 text-sm" aria-live="polite">
      <strong>{resumen.cantidadBultos}</strong> bultos · {formatearKg(resumen.pesoTotalKg)} ·{" "}
      {formatearM3(resumen.volumenTotalM3)}
      {resumen.itemsSinMedidas ? (
        <span className="text-muted-foreground">
          {" "}
          · {resumen.itemsSinMedidas} {resumen.itemsSinMedidas === 1 ? "ítem" : "ítems"} sin medidas o peso
          (con ellos el presupuesto es más preciso)
        </span>
      ) : null}
    </p>
  );
}

export function FormSolicitud() {
  const router = useRouter();
  const hoy = fechaIsoAr();
  const form = useForm<SolicitudInput, unknown, SolicitudDatos>({
    resolver: zodResolver(solicitudSchema),
    defaultValues: {
      titulo: "",
      descripcion: "",
      fecha: sumarDias(hoy, 1),
      franja: "MANANA",
      ayudantesRequeridos: 0,
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
  const { register, control, handleSubmit, getValues, watch, setError, formState } = form;
  const { errors, isSubmitting } = formState;
  const { fields, append, remove } = useFieldArray({ control, name: "items" });
  const { mensaje, enviar } = useEnvio(setError);
  const tipoFlete = watch("tipoFlete");
  const franja = watch("franja");
  const items = watch("items");

  const onSubmit = handleSubmit(async () => {
    const resultado = await enviar(() => crearSolicitud(getValues()));
    if (resultado) router.push(`/cliente/solicitudes/${resultado.data.id}?nueva=1`);
  });

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-5">
      <FormMensaje mensaje={mensaje} />

      <Seccion titulo="¿Qué necesitás trasladar?">
        <fieldset className="grid gap-2">
          <legend className="mb-1 text-sm font-semibold">Tipo de flete</legend>
          <div className="grid gap-2 sm:grid-cols-3">
            {TIPOS_FLETE.map((t) => (
              <RadioCard
                key={t}
                value={t}
                checked={tipoFlete === t}
                title={ETIQUETA_TIPO_FLETE[t]}
                className="p-3"
                {...register("tipoFlete")}
              />
            ))}
          </div>
          {errors.tipoFlete ? (
            <p className="text-sm font-medium text-destructive">{errors.tipoFlete.message}</p>
          ) : null}
        </fieldset>
        <FormField
          label="Título"
          placeholder="Ej.: Heladera y lavarropas"
          error={errors.titulo?.message}
          {...register("titulo")}
        />
        <TextareaField
          label="Detalles (opcional)"
          rows={3}
          placeholder="Ej.: La heladera es de dos puertas. Hay que bajarla por escalera."
          error={errors.descripcion?.message}
          {...register("descripcion")}
        />
      </Seccion>

      <div className="grid gap-5 lg:grid-cols-2">
        <Seccion titulo="Desde dónde">
          <Lugar form={form} prefijo="origen" />
        </Seccion>
        <Seccion titulo="Hasta dónde">
          <Lugar form={form} prefijo="destino" />
        </Seccion>
      </div>

      <Seccion titulo="Cuándo">
        <FormField
          label="Día"
          type="date"
          min={hoy}
          max={sumarDias(hoy, DIAS_MAXIMOS_ANTICIPACION)}
          error={errors.fecha?.message}
          {...register("fecha")}
        />
        <fieldset className="grid gap-2">
          <legend className="mb-1 text-sm font-semibold">Horario</legend>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {FRANJAS_HORARIAS.map((f) => (
              <RadioCard
                key={f}
                value={f}
                checked={franja === f}
                title={FRANJA[f].etiqueta}
                className="p-3 text-sm"
                {...register("franja")}
              />
            ))}
          </div>
        </fieldset>
      </Seccion>

      <Seccion
        titulo="Qué hay que llevar"
        ayuda="Con las medidas y el peso aproximados, los fleteros te pasan un precio más justo. Este listado es el inventario que se controla al cargar y al entregar."
      >
        <ol className="grid gap-3">
          {fields.map((campo, i) => {
            const e = errors.items?.[i];
            return (
              <li key={campo.id} className="grid gap-3 rounded-lg border bg-muted/20 p-3">
                <div className="flex items-start gap-2">
                  <span className="mt-9 font-heading text-lg font-extrabold text-muted-foreground">
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
                    hint="Queda registrado: si ya tiene marcas, el fletero lo confirma al cargar."
                    {...register(`items.${i}.estadoInicial`)}
                  >
                    {ESTADOS_INICIALES_ITEM.map((estado) => (
                      <option key={estado} value={estado}>
                        {ETIQUETA_ESTADO_INICIAL[estado]}
                      </option>
                    ))}
                  </SelectField>
                  <label className="flex items-center gap-3 self-start rounded-md border px-3 py-2.5 font-semibold sm:mt-7">
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
            Agregar otro ítem
          </Button>
        ) : null}
        <ResumenCargaVivo items={items} />
      </Seccion>

      <Seccion titulo="Ayuda extra">
        <div className="grid gap-3 sm:grid-cols-2">
          <FormField
            label="Ayudantes para cargar"
            type="number"
            inputMode="numeric"
            min={0}
            max={10}
            hint="Además del fletero."
            error={errors.ayudantesRequeridos?.message}
            {...register("ayudantesRequeridos")}
          />
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
        </div>
      </Seccion>

      <SubmitButton
        pending={isSubmitting}
        pendingLabel="Publicando…"
        size="lg"
        className="w-full sm:w-auto sm:justify-self-end"
      >
        Publicar y recibir presupuestos
      </SubmitButton>
    </form>
  );
}
