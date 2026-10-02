import "server-only";
import { Document, Page, renderToBuffer, StyleSheet, Text, View } from "@react-pdf/renderer";
import { ETIQUETA_ESTADO_INICIAL, ETIQUETA_RESULTADO, FRANJA } from "@/domain/catalogos";
import { ETIQUETA_CICLO } from "@/domain/ciclo-flete";
import { formatearDiaAbsoluto, formatearFechaHora, formatearPesos } from "@/lib/formato";
import type { FleteDetalle, ControlDto } from "../queries";

// Comprobante del flete: partes, recorrido, estados con hora y ubicación, inventario con cada
// control, reclamos y firmas de conformidad. Usa Helvetica (incluida en todo lector de PDF): sin
// archivos de fuentes que empaquetar en el servidor.

/**
 * Helvetica estándar solo cubre Latin-1 (más algunos signos): se normalizan los espacios raros
 * de Intl y se quitan emojis y otros caracteres que saldrían como basura.
 */
export function textoPdf(texto: string): string {
  return texto
    .normalize("NFC")
    .replace(/[   ]/g, " ")
    .replace(/[^\t\n -~ -ÿ–—‘’“”•…€]/g, "");
}

const c = {
  tinta: "#1f2a24",
  suave: "#5b665f",
  linea: "#c9c2b0",
  fondo: "#f4efe3",
  alerta: "#9b1c1c",
  ok: "#1f6f4a",
};

const s = StyleSheet.create({
  pagina: {
    padding: 36,
    paddingBottom: 54,
    fontSize: 9,
    fontFamily: "Helvetica",
    color: c.tinta,
    lineHeight: 1.35,
  },
  encabezado: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 14,
  },
  titulo: { fontSize: 18, fontFamily: "Helvetica-Bold", lineHeight: 1.2, marginBottom: 4 },
  provisorio: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: c.alerta,
    borderWidth: 1,
    borderColor: c.alerta,
    padding: "3 6",
    marginTop: 4,
  },
  suave: { color: c.suave },
  seccion: { marginTop: 14 },
  h2: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    marginBottom: 6,
    paddingBottom: 3,
    borderBottomWidth: 1,
    borderBottomColor: c.linea,
  },
  dosColumnas: { flexDirection: "row", gap: 16 },
  columna: { flex: 1 },
  dato: { marginBottom: 4 },
  etiqueta: { color: c.suave, fontSize: 8 },
  fila: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: c.linea, paddingVertical: 4 },
  filaEncabezado: {
    flexDirection: "row",
    backgroundColor: c.fondo,
    paddingVertical: 4,
    fontFamily: "Helvetica-Bold",
  },
  celda: { paddingHorizontal: 3 },
  negrita: { fontFamily: "Helvetica-Bold" },
  alerta: { color: c.alerta },
  ok: { color: c.ok },
  observacion: { color: c.suave, fontSize: 8, marginTop: 1 },
  firma: { borderWidth: 1, borderColor: c.linea, padding: 8, marginBottom: 8 },
  // Con `top` y no `bottom`: react-pdf mide con alto 0 el texto dinámico (número de página)
  // posicionado desde abajo y no lo dibuja. 806 pt = alto de A4 (841,9) menos el margen inferior.
  pie: { position: "absolute", top: 806, left: 36, right: 36, color: c.suave, fontSize: 7 },
});

const t = textoPdf;

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <View style={s.dato}>
      <Text style={s.etiqueta}>{t(etiqueta)}</Text>
      <Text>{t(valor)}</Text>
    </View>
  );
}

function celdaControl(control: ControlDto | null) {
  if (!control) return <Text style={s.suave}>—</Text>;
  const problema = ["CON_DANO", "FALTANTE", "RECLAMO", "NO_CARGADO"].includes(control.resultado);
  return (
    <View>
      <Text style={problema ? s.alerta : s.ok}>{t(ETIQUETA_RESULTADO[control.resultado])}</Text>
      <Text style={s.observacion}>{t(formatearFechaHora(control.fecha))}</Text>
      {control.observacion ? <Text style={s.observacion}>{t(`«${control.observacion}»`)}</Text> : null}
    </View>
  );
}

const COLUMNAS_INVENTARIO = [
  { titulo: "Ítem", ancho: "24%" },
  { titulo: "Estado inicial", ancho: "13%" },
  { titulo: "Carga", ancho: "21%" },
  { titulo: "Descarga", ancho: "21%" },
  { titulo: "Recepción", ancho: "21%" },
] as const;

const COLUMNAS_ESTADOS = [
  { titulo: "Etapa", ancho: "28%" },
  { titulo: "Fecha y hora", ancho: "22%" },
  { titulo: "Registró", ancho: "16%" },
  { titulo: "Ubicación", ancho: "34%" },
] as const;

function Comprobante({ f, emitido }: { f: FleteDetalle; emitido: Date }) {
  const cerrado = f.etapa === "CERRADO";
  const r = f.resumen;
  const reclamos = f.items.filter((i) => i.reclamo);
  return (
    <Document title={t(`Comprobante de flete — ${f.titulo}`)} author="Fletes Tucumán" language="es-AR">
      <Page size="A4" style={s.pagina}>
        {/* Pie fijo en cada página: va primero para que se repita desde la primera. */}
        <Text style={s.pie} fixed>
          {t(`Fletes Tucumán · comprobante N.º ${f.id}`)}
        </Text>
        <Text
          style={[s.pie, { textAlign: "right" }]}
          fixed
          render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`}
        />
        <View style={s.encabezado}>
          <View>
            <Text style={s.titulo}>Comprobante de flete</Text>
            <Text style={s.suave}>{t(`N.º ${f.id} · emitido el ${formatearFechaHora(emitido)}`)}</Text>
          </View>
          {!cerrado ? (
            <Text style={s.provisorio}>PROVISORIO: el cliente todavía no cerró el flete</Text>
          ) : null}
        </View>

        <View style={s.dosColumnas}>
          <View style={s.columna}>
            <Dato etiqueta="Flete" valor={f.titulo} />
            <Dato etiqueta="Cliente" valor={f.cliente} />
            <Dato etiqueta="Fletero" valor={f.fletero} />
            <Dato
              etiqueta="Vehículo"
              valor={`${f.vehiculo.marca} ${f.vehiculo.modelo} · patente ${f.vehiculo.patente}`}
            />
          </View>
          <View style={s.columna}>
            <Dato
              etiqueta="Fecha acordada"
              valor={`${formatearDiaAbsoluto(f.fecha)} · ${FRANJA[f.franja].etiqueta}`}
            />
            <Dato etiqueta="Precio acordado" valor={formatearPesos(f.precioAcordado)} />
            <Dato etiqueta="Retiro" valor={f.origen.direccion} />
            <Dato etiqueta="Entrega" valor={f.destino.direccion} />
          </View>
        </View>

        <View style={s.seccion}>
          <Text style={s.h2}>Estados</Text>
          <View style={s.filaEncabezado}>
            {COLUMNAS_ESTADOS.map((col) => (
              <Text key={col.titulo} style={[s.celda, { width: col.ancho }]}>
                {t(col.titulo)}
              </Text>
            ))}
          </View>
          {f.historial.map((h) => (
            <View key={h.id} style={s.fila} wrap={false}>
              <Text style={[s.celda, { width: COLUMNAS_ESTADOS[0].ancho }]}>
                {t(ETIQUETA_CICLO[h.etapa])}
                {h.nota ? t(` · «${h.nota}»`) : ""}
              </Text>
              <Text style={[s.celda, { width: COLUMNAS_ESTADOS[1].ancho }]}>
                {t(formatearFechaHora(h.fecha))}
              </Text>
              <Text style={[s.celda, { width: COLUMNAS_ESTADOS[2].ancho }]}>
                {h.porRol === "CLIENTE" ? "Cliente" : "Fletero"}
              </Text>
              <Text style={[s.celda, { width: COLUMNAS_ESTADOS[3].ancho }]}>
                {h.ubicacion
                  ? t(
                      `${h.ubicacion.lat.toFixed(5)}, ${h.ubicacion.lng.toFixed(5)}` +
                        (h.ubicacion.precisionM !== null ? ` (±${h.ubicacion.precisionM} m)` : ""),
                    )
                  : "No compartida"}
              </Text>
            </View>
          ))}
        </View>

        <View style={s.seccion}>
          <Text style={s.h2}>Inventario</Text>
          <Text style={[s.suave, { marginBottom: 6 }]}>
            {t(
              `Cargados: ${r.cargados} de ${r.total}${r.noCargados ? ` (${r.noCargados} sin cargar)` : ""} · ` +
                `Entregados: ${r.entregados + r.conDano} · Con daño: ${r.conDano} · Faltantes: ${r.faltantes} · ` +
                `Recibidos conformes: ${r.conformes} · Reclamos: ${r.reclamos}`,
            )}
          </Text>
          <View style={s.filaEncabezado}>
            {COLUMNAS_INVENTARIO.map((col) => (
              <Text key={col.titulo} style={[s.celda, { width: col.ancho }]}>
                {t(col.titulo)}
              </Text>
            ))}
          </View>
          {f.items.map((item) => (
            <View key={item.id} style={s.fila} wrap={false}>
              <View style={[s.celda, { width: COLUMNAS_INVENTARIO[0].ancho }]}>
                <Text style={s.negrita}>
                  {t(`${item.cantidad > 1 ? `${item.cantidad} × ` : ""}${item.nombre}`)}
                </Text>
                {item.fragil ? <Text style={s.observacion}>Frágil</Text> : null}
                {item.notas ? <Text style={s.observacion}>{t(item.notas)}</Text> : null}
              </View>
              <Text style={[s.celda, { width: COLUMNAS_INVENTARIO[1].ancho }]}>
                {t(ETIQUETA_ESTADO_INICIAL[item.estadoInicial])}
              </Text>
              <View style={[s.celda, { width: COLUMNAS_INVENTARIO[2].ancho }]}>
                {celdaControl(item.carga)}
              </View>
              <View style={[s.celda, { width: COLUMNAS_INVENTARIO[3].ancho }]}>
                {celdaControl(item.descarga)}
              </View>
              <View style={[s.celda, { width: COLUMNAS_INVENTARIO[4].ancho }]}>
                {celdaControl(item.recepcion)}
              </View>
            </View>
          ))}
        </View>

        {reclamos.length > 0 ? (
          <View style={s.seccion}>
            <Text style={s.h2}>Reclamos</Text>
            {reclamos.map((item) => (
              <View key={item.id} style={s.dato} wrap={false}>
                <Text>
                  <Text style={s.negrita}>{t(item.nombre)}</Text>
                  {t(
                    ` · ${item.reclamo!.estado === "ABIERTO" ? "abierto" : "resuelto"} · ${formatearFechaHora(item.reclamo!.fecha)}`,
                  )}
                </Text>
                <Text style={s.suave}>{t(`«${item.reclamo!.descripcion}»`)}</Text>
              </View>
            ))}
          </View>
        ) : null}

        <View style={s.seccion} wrap={false}>
          <Text style={s.h2}>Firmas de conformidad</Text>
          {(["FLETERO", "CLIENTE"] as const).map((rol) => {
            const firma = f.conformidades.find((x) => x.rol === rol);
            return (
              <View key={rol} style={s.firma}>
                <Text style={s.negrita}>
                  {rol === "FLETERO" ? "Fletero" : "Cliente"}: {t(rol === "FLETERO" ? f.fletero : f.cliente)}
                </Text>
                {firma ? (
                  <>
                    <Text>{t(firma.texto)}</Text>
                    <Text style={s.ok}>{t(`[X] Aceptado el ${formatearFechaHora(firma.aceptadaEn)}`)}</Text>
                  </>
                ) : (
                  <Text style={s.suave}>[ ] Pendiente</Text>
                )}
              </View>
            );
          })}
        </View>
      </Page>
    </Document>
  );
}

export function renderizarComprobante(f: FleteDetalle, emitido: Date = new Date()): Promise<Buffer> {
  return renderToBuffer(<Comprobante f={f} emitido={emitido} />);
}
