import { GaleriaFotos } from "@/components/shared/galeria-fotos";
import { Badge, type BadgeVariant } from "@/components/ui/badge";
import { ETIQUETA_ESTADO_INICIAL, ETIQUETA_RESULTADO, type ResultadoControl } from "@/domain/catalogos";
import { formatearFechaHora } from "@/lib/formato";
import { tonoResultado } from "../presentacion";
import type { ControlDto, ItemDto } from "../queries";

const VARIANTE: Record<ReturnType<typeof tonoResultado>, BadgeVariant> = {
  ok: "success",
  alerta: "destructive",
  neutro: "muted",
};

export function ChipResultado({ resultado }: { resultado: ResultadoControl }) {
  return <Badge variant={VARIANTE[tonoResultado(resultado)]}>{ETIQUETA_RESULTADO[resultado]}</Badge>;
}

/** Un control registrado: resultado, hora, observación y fotos. */
export function DetalleControl({
  etiqueta,
  control,
  item,
}: {
  etiqueta: string;
  control: ControlDto;
  item: string;
}) {
  return (
    <div className="grid gap-1.5 text-sm">
      <p className="flex flex-wrap items-center gap-2">
        <span className="font-semibold text-muted-foreground">{etiqueta}</span>
        <ChipResultado resultado={control.resultado} />
        <time dateTime={control.fecha.toISOString()} className="tabular-nums text-muted-foreground">
          {formatearFechaHora(control.fecha)}
        </time>
      </p>
      {control.observacion ? <p className="whitespace-pre-line">«{control.observacion}»</p> : null}
      {control.fotos.length > 0 ? (
        <GaleriaFotos fotos={control.fotos} descripcion={`${item}, ${etiqueta.toLowerCase()}`} />
      ) : null}
    </div>
  );
}

/** Nombre, cantidad y lo que declaró el cliente: igual en todas las listas de inventario. */
export function EncabezadoItem({
  item,
}: {
  item: Pick<ItemDto, "nombre" | "cantidad" | "fragil" | "notas" | "estadoInicial">;
}) {
  return (
    <div className="grid gap-1">
      <p className="flex flex-wrap items-center gap-2">
        <span className="font-semibold">
          {item.cantidad > 1 ? `${item.cantidad} × ` : ""}
          {item.nombre}
        </span>
        {item.fragil ? <Badge variant="warning">Frágil</Badge> : null}
        {item.estadoInicial !== "BUENO" ? (
          <Badge variant="outline">{ETIQUETA_ESTADO_INICIAL[item.estadoInicial]}</Badge>
        ) : null}
      </p>
      {item.notas ? <p className="text-sm text-muted-foreground">{item.notas}</p> : null}
    </div>
  );
}
