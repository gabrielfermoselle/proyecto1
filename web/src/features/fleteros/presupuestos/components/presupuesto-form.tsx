"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { AlertTriangle, CalendarX, Minus, Package, Plus } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import type { z } from "zod";
import { FormField, TextareaField } from "@/components/shared/form-field";
import { FormMensaje } from "@/components/shared/form-mensaje";
import { RadioCard } from "@/components/shared/radio-card";
import { SubmitButton } from "@/components/shared/submit-button";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ETIQUETA_COMPATIBILIDAD, type ResultadoCompatibilidad } from "@/domain/compatibilidad";
import { ETIQUETA_VEHICULO, FRANJA, type FranjaHoraria, type TipoVehiculo } from "@/domain/catalogos";
import { precioSugerido, type Tarifas } from "@/domain/precio";
import { calcularValidoHasta, esPrecioMuyBajo, ETIQUETA_VALIDEZ, VALIDECES } from "@/domain/presupuesto";
import { VehiculoIcono } from "@/features/fleteros/components/vehiculo-icono";
import { formatearFechaHora, formatearKg, formatearM3, formatearPesos } from "@/lib/formato";
import { useEnvio } from "@/lib/use-envio";
import { enviarPresupuesto } from "../actions";
import { presupuestoSchema, type PresupuestoInput } from "../schemas";

interface VehiculoOpcion {
  id: string;
  tipo: TipoVehiculo;
  marca: string;
  modelo: string;
  capacidadKg: number;
  volumenM3: number;
  compatibilidad: ResultadoCompatibilidad;
  puedeLlevar: boolean;
}

interface PresupuestoFormProps {
  solicitudId: string;
  fechaFlete: string;
  vehiculos: VehiculoOpcion[];
  vehiculoSugeridoId: string | null;
  tarifas: Tarifas;
  distanciaLinealKm: number;
  volumenM3: number;
  ayudantesRequeridos: number;
  /** Franja que pidió el cliente: la hora de llegada tiene que caer adentro. */
  franja: FranjaHoraria;
  pideEmbalaje: boolean;
  conflictos: { id: string; titulo: string; franja: FranjaHoraria }[];
}

const dosDigitos = (n: number) => String(n).padStart(2, "0");

export function PresupuestoForm(props: PresupuestoFormProps) {
  const { solicitudId, fechaFlete, vehiculos, tarifas, distanciaLinealKm, volumenM3, conflictos } = props;
  const sugeridoPara = (ayudantes: number) =>
    precioSugerido({ distanciaLinealKm, volumenM3, ayudantes }, tarifas);

  const [montoEditado, setMontoEditado] = useState(false);
  const {
    register,
    handleSubmit,
    getValues,
    setValue,
    setError,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<PresupuestoInput, unknown, z.output<typeof presupuestoSchema>>({
    resolver: zodResolver(presupuestoSchema),
    defaultValues: {
      solicitudId,
      ...(props.vehiculoSugeridoId ? { vehiculoId: props.vehiculoSugeridoId } : {}),
      monto: sugeridoPara(props.ayudantesRequeridos),
      ayudantes: props.ayudantesRequeridos,
      validez: "48h",
      horaLlegada: "",
      mensaje: "",
    },
  });
  const { mensaje, enviar } = useEnvio(setError);

  const ayudantes = Number(watch("ayudantes")) || 0;
  const monto = Number(watch("monto")) || 0;
  const validez = watch("validez");
  const sugerido = sugeridoPara(ayudantes);

  function cambiarAyudantes(delta: number) {
    const nuevo = Math.min(10, Math.max(0, ayudantes + delta));
    setValue("ayudantes", nuevo);
    // Mientras el fletero no toque el monto, acompaña a la sugerencia.
    if (!montoEditado) setValue("monto", sugeridoPara(nuevo), { shouldValidate: true });
  }

  const onSubmit = handleSubmit(async () => {
    await enviar(() => enviarPresupuesto(getValues()));
  });

  const montoRegistro = register("monto", { onChange: () => setMontoEditado(true) });

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-5">
      <FormMensaje mensaje={mensaje} />

      {conflictos.length > 0 ? (
        <Alert variant="destructive" role="status">
          <CalendarX aria-hidden="true" />
          <div>
            <p className="font-semibold">Ese día ya tenés un flete en un horario que se superpone:</p>
            <ul className="mt-1 list-inside list-disc">
              {conflictos.map((c) => (
                <li key={c.id}>
                  {c.titulo} ({FRANJA[c.franja].etiqueta})
                </li>
              ))}
            </ul>
          </div>
        </Alert>
      ) : null}

      <fieldset className="grid gap-2">
        <legend className="mb-1 text-sm font-semibold">¿Con qué vehículo?</legend>
        {vehiculos.map((v) => (
          <RadioCard
            key={v.id}
            value={v.id}
            disabled={!v.puedeLlevar}
            icon={<VehiculoIcono tipo={v.tipo} />}
            title={`${v.marca} ${v.modelo}`}
            description={
              <>
                {ETIQUETA_VEHICULO[v.tipo]} · {formatearKg(v.capacidadKg)} · {formatearM3(v.volumenM3)}
                <span className={v.puedeLlevar ? "block text-success" : "block text-destructive"}>
                  {ETIQUETA_COMPATIBILIDAD[v.compatibilidad]}
                </span>
              </>
            }
            className="p-3"
            {...register("vehiculoId")}
          />
        ))}
        {errors.vehiculoId ? (
          <p className="text-sm font-medium text-destructive">{errors.vehiculoId.message}</p>
        ) : null}
      </fieldset>

      <fieldset className="grid gap-2">
        <legend className="mb-1 text-sm font-semibold">Ayudantes</legend>
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => cambiarAyudantes(-1)}
            disabled={ayudantes === 0}
          >
            <Minus aria-hidden="true" />
            <span className="sr-only">Quitar un ayudante</span>
          </Button>
          <output
            aria-live="polite"
            className="min-w-8 text-center font-heading text-2xl font-extrabold tabular-nums"
          >
            {ayudantes}
          </output>
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => cambiarAyudantes(1)}
            disabled={ayudantes === 10}
          >
            <Plus aria-hidden="true" />
            <span className="sr-only">Sumar un ayudante</span>
          </Button>
          <span className="text-sm text-muted-foreground">
            {props.ayudantesRequeridos > 0
              ? `El cliente pidió ${props.ayudantesRequeridos}`
              : "El cliente no pidió ayudantes"}
          </span>
        </div>
        <input type="hidden" {...register("ayudantes")} />
      </fieldset>

      <div className="grid gap-2">
        <FormField
          label="Tu precio ($)"
          type="number"
          inputMode="numeric"
          min={1000}
          step={100}
          className="h-14 font-heading text-2xl font-extrabold"
          error={errors.monto?.message}
          {...montoRegistro}
        />
        <p className="flex flex-wrap items-center gap-x-2 text-sm text-muted-foreground">
          Sugerido con tus tarifas: <strong className="text-foreground">{formatearPesos(sugerido)}</strong>
          {monto !== sugerido ? (
            <Button
              type="button"
              variant="link"
              size="sm"
              className="h-auto px-0"
              onClick={() => {
                setValue("monto", sugerido, { shouldValidate: true });
                setMontoEditado(false);
              }}
            >
              Usar el sugerido
            </Button>
          ) : null}
        </p>
        {esPrecioMuyBajo(monto, sugerido) ? (
          <p role="status" className="flex items-center gap-2 text-sm font-medium text-warning">
            <AlertTriangle className="size-4" aria-hidden="true" />
            Está muy por debajo del sugerido. ¿Te falta un cero?
          </p>
        ) : null}
      </div>

      <div className="grid gap-2">
        <FormField
          label="Hora de llegada (opcional)"
          type="time"
          min={`${dosDigitos(FRANJA[props.franja].desde)}:00`}
          max={`${dosDigitos(FRANJA[props.franja].hasta)}:00`}
          step={900}
          className="max-w-[10rem]"
          hint={`El cliente lo pidió para ${FRANJA[props.franja].etiqueta.toLowerCase()}.`}
          error={errors.horaLlegada?.message}
          {...register("horaLlegada")}
        />
      </div>

      {props.pideEmbalaje ? (
        <p className="flex items-start gap-2 rounded-lg bg-accent/15 px-3 py-2 text-sm">
          <Package className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          El cliente pidió embalaje: si lo incluís, contalo en el mensaje.
        </p>
      ) : null}

      <fieldset className="grid gap-2">
        <legend className="mb-1 text-sm font-semibold">El presupuesto vale por</legend>
        <div className="grid grid-cols-3 gap-2">
          {VALIDECES.map((v) => (
            <RadioCard
              key={v}
              value={v}
              title={ETIQUETA_VALIDEZ[v]}
              className="justify-center p-3 text-center"
              {...register("validez")}
            />
          ))}
        </div>
        {validez ? (
          <p className="text-sm text-muted-foreground">
            Vence el {formatearFechaHora(calcularValidoHasta(validez, fechaFlete))} (nunca después del día del
            flete).
          </p>
        ) : null}
      </fieldset>

      <TextareaField
        label="Mensaje para el cliente (opcional)"
        rows={3}
        maxLength={500}
        placeholder="Ej.: Voy con mantas y un ayudante. Puedo pasar a partir de las 9."
        hint="No compartas tu teléfono: la coordinación es por el chat de la plataforma."
        error={errors.mensaje?.message}
        {...register("mensaje")}
      />

      <SubmitButton pending={isSubmitting} pendingLabel="Enviando…" size="lg" className="w-full">
        Enviar presupuesto de {formatearPesos(monto)}
      </SubmitButton>
    </form>
  );
}
