import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../services/api.js";
import { useToast } from "../context/ToastContext.jsx";
import ChatPanel from "../components/ChatPanel.jsx";
import ConfirmDialog from "../components/ConfirmDialog.jsx";
import EstadoStepper from "../components/EstadoStepper.jsx";
import MapView from "../components/MapView.jsx";
import ReviewForm from "../components/ReviewForm.jsx";
import { StarsDisplay } from "../components/Stars.jsx";
import { SkeletonBlock, SkeletonText } from "../components/Skeleton.jsx";
import { CARGA_LABEL, ESTADO_LABEL, VEHICULO_LABEL } from "../utils/catalogos.js";
import { formatFecha, formatPrecio } from "../utils/format.js";

function DetalleSkeleton() {
  return (
    <div className="grid cols-2" aria-busy="true" aria-label="Cargando solicitud">
      <div className="card">
        <SkeletonBlock className="mb-3 h-6 w-2/3" />
        <SkeletonText lines={3} />
      </div>
      <div className="card">
        <SkeletonBlock className="h-5 w-1/3" />
        <SkeletonBlock className="mt-4 h-64 w-full" />
      </div>
    </div>
  );
}

// Formulario del fletero para enviar o actualizar su presupuesto.
function PresupuestoForm({ solicitud, onSaved }) {
  const mio = solicitud.presupuestos[0];
  const [monto, setMonto] = useState(mio?.monto ?? "");
  const [mensaje, setMensaje] = useState(mio?.mensaje ?? "");
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    try {
      onSaved(await api.post(`/solicitudes/${solicitud.id}/presupuestos`, { monto: Number(monto), mensaje }), !mio);
    } catch {
      // El toast global ya avisó del error.
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit}>
      <div className="field">
        <label htmlFor="p-monto">Monto total ($)</label>
        <input id="p-monto" type="number" min="1" value={monto} onChange={(e) => setMonto(e.target.value)} required />
      </div>
      <div className="field">
        <label htmlFor="p-msg">Mensaje</label>
        <textarea
          id="p-msg"
          value={mensaje}
          onChange={(e) => setMensaje(e.target.value)}
          placeholder="Mensaje (opcional)"
        />
      </div>
      <button className="btn gold" disabled={busy}>
        {busy ? "Enviando…" : mio ? "Actualizar presupuesto" : "Enviar presupuesto"}
      </button>
    </form>
  );
}

export default function SolicitudDetalle() {
  const { id } = useParams();
  const toast = useToast();
  const [s, setS] = useState(null);
  const [error, setError] = useState("");
  const [orden, setOrden] = useState("monto");
  const [chatCon, setChatCon] = useState(null); // fleteroId de la conversación abierta (cliente)
  const [confirmar, setConfirmar] = useState(null); // { title, message, confirmLabel, action }
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      setS(await api.get(`/solicitudes/${id}`, { silent: true }));
    } catch (e) {
      setError(e.message);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const presupuestos = useMemo(() => {
    if (!s) return [];
    const list = [...s.presupuestos];
    if (orden === "calificacion") {
      list.sort((a, b) => (b.fletero?.promedioCalificacion || 0) - (a.fletero?.promedioCalificacion || 0));
    } else {
      list.sort((a, b) => a.monto - b.monto);
    }
    return list;
  }, [s, orden]);

  if (error && !s) return <div className="alert error">{error}</div>;
  if (!s) return <DetalleSkeleton />;

  async function run(fn, okMsg) {
    setBusy(true);
    try {
      setS(await fn());
      if (okMsg) toast.success(okMsg);
    } catch {
      // El toast global ya avisó del error.
    } finally {
      setBusy(false);
    }
  }

  const cambiarEstado = (estado, okMsg) => run(() => api.patch(`/solicitudes/${id}/estado`, { estado }), okMsg);
  const marcarItem = (itemId, campo, valor) =>
    run(() => api.patch(`/solicitudes/${id}/inventario/${itemId}`, { [campo]: valor }));

  const { esCliente, esFleteroAsignado } = s;
  const inventario = s.inventario;
  const faseCarga = esFleteroAsignado && s.estado === "confirmada";
  const faseDescarga = esFleteroAsignado && s.estado === "en_transito";
  const todoCargado = inventario.every((i) => i.cargado);
  const todoEntregado = inventario.every((i) => i.entregado);

  // Conversaciones disponibles: el cliente habla con quienes cotizaron (o con el asignado);
  // el fletero, solo sobre su propia participación.
  const conversaciones = esCliente
    ? presupuestos
        .filter((p) => s.estado === "publicada" || p.fleteroId === s.fleteroId)
        .map((p) => ({ fleteroId: p.fleteroId, nombre: p.fletero?.nombre || "Fletero" }))
    : s.miFleteroId && (s.presupuestos.length > 0 || esFleteroAsignado)
      ? [{ fleteroId: s.miFleteroId, nombre: s.clienteNombre }]
      : [];
  const chatActivo = conversaciones.find((c) => c.fleteroId === chatCon) || conversaciones[0] || null;
  const otroElegido = !esCliente && s.fleteroId && !esFleteroAsignado;

  return (
    <div className="grid cols-2">
      <div className="grid" style={{ gap: 20, alignContent: "start" }}>
        <div className="card">
          <div className="spread">
            <h2 style={{ margin: 0 }}>{s.titulo}</h2>
            <span className={`status ${s.estado}`}>{ESTADO_LABEL[s.estado]}</span>
          </div>
          <div className="chips" style={{ margin: "10px 0" }}>
            <span className="chip">{CARGA_LABEL[s.tipoCarga]}</span>
            <span className="chip">📅 {formatFecha(s.fecha, { hora: true })}</span>
            {s.tipoVehiculo && <span className="chip">{VEHICULO_LABEL[s.tipoVehiculo]}</span>}
          </div>
          <p className="muted" style={{ margin: 0 }}>
            {esCliente ? (s.fleteroNombre ? `Fletero: ${s.fleteroNombre}` : "") : `Cliente: ${s.clienteNombre}`}
          </p>
          {s.descripcion && <p>{s.descripcion}</p>}
          {s.precioAcordado != null && (
            <p className="tag-price" style={{ fontSize: 18 }}>Precio acordado: {formatPrecio(s.precioAcordado)}</p>
          )}
          {s.fotos.length > 0 && (
            <div className="fotos-grid" style={{ marginBottom: 12 }}>
              {s.fotos.map((src, i) => (
                <a className="foto-thumb" key={i} href={src} target="_blank" rel="noreferrer">
                  <img src={src} alt={`Foto ${i + 1} de la carga`} />
                </a>
              ))}
            </div>
          )}

          {esCliente && (
            <div className="row">
              {s.estado === "publicada" && (
                <Link className="btn ghost" to={`/solicitud/${s.id}/editar`}>Editar solicitud</Link>
              )}
              {s.estado === "entregada" && (
                <button className="btn success" disabled={busy} onClick={() => cambiarEstado("completada", "¡Recepción confirmada!")}>
                  Confirmar recepción
                </button>
              )}
              {["publicada", "confirmada"].includes(s.estado) && (
                <button
                  className="btn danger"
                  disabled={busy}
                  onClick={() =>
                    setConfirmar({
                      title: "¿Cancelar este flete?",
                      message: "No se puede deshacer.",
                      confirmLabel: "Cancelar flete",
                      action: () => cambiarEstado("cancelada")
                    })
                  }
                >
                  Cancelar
                </button>
              )}
            </div>
          )}

          {esFleteroAsignado && (
            <div className="grid" style={{ gap: 10 }}>
              {s.estado === "confirmada" && (
                <>
                  <div className="row">
                    <button className="btn" disabled={busy || !todoCargado} onClick={() => cambiarEstado("en_transito", "Traslado iniciado.")}>
                      Iniciar traslado
                    </button>
                    <button
                      className="btn danger"
                      disabled={busy}
                      onClick={() =>
                        setConfirmar({
                          title: "¿Cancelar este flete?",
                          message: "No se puede deshacer.",
                          confirmLabel: "Cancelar flete",
                          action: () => cambiarEstado("cancelada")
                        })
                      }
                    >
                      Cancelar
                    </button>
                  </div>
                  {!todoCargado && <p className="muted" style={{ margin: 0 }}>Falta registrar la carga.</p>}
                </>
              )}
              {s.estado === "en_transito" && (
                <>
                  <button className="btn success" disabled={busy || !todoEntregado} onClick={() => cambiarEstado("entregada", "Descarga registrada.")}>
                    Registrar entrega
                  </button>
                  {!todoEntregado && <p className="muted" style={{ margin: 0 }}>Falta registrar la descarga.</p>}
                </>
              )}
              {s.estado === "entregada" && (
                <p className="muted" style={{ margin: 0 }}>Esperando confirmación del cliente.</p>
              )}
            </div>
          )}
        </div>

        <div className="card">
          <h3>Seguimiento</h3>
          <EstadoStepper estado={s.estado} historial={s.historial} />
        </div>

        <div className="card">
          <div className="spread" style={{ marginBottom: 8 }}>
            <h3 style={{ margin: 0 }}>Inventario</h3>
            {inventario.length > 0 && (
              <span className="muted">
                {inventario.filter((i) => i.cargado).length}/{inventario.length} cargados ·{" "}
                {inventario.filter((i) => i.entregado).length}/{inventario.length} entregados
              </span>
            )}
          </div>
          {inventario.length === 0 && <div className="empty">Sin objetos.</div>}
          <ul className="inventario-list">
            {inventario.map((item) => (
              <li key={item.id} className="inventario-item">
                {item.fotoUrl ? (
                  <a href={item.fotoUrl} target="_blank" rel="noreferrer">
                    <img src={item.fotoUrl} alt={item.nombre} />
                  </a>
                ) : (
                  <span className="inventario-placeholder">📦</span>
                )}
                <div className="inventario-body">
                  <div style={{ fontWeight: 700 }}>
                    {item.nombre} <span className="muted">× {item.cantidad}</span>
                  </div>
                  <div className="chips">
                    <span className={`chip ${item.cargado ? "chip-ok" : ""}`}>
                      {item.cargado ? `Cargado ${formatFecha(item.cargadoEn, { hora: true })}` : "Sin cargar"}
                    </span>
                    <span className={`chip ${item.entregado ? "chip-ok" : ""}`}>
                      {item.entregado ? `Entregado ${formatFecha(item.entregadoEn, { hora: true })}` : "Sin entregar"}
                    </span>
                  </div>
                </div>
                {faseCarga && (
                  <label className="check-inline">
                    <input type="checkbox" checked={item.cargado} disabled={busy} onChange={(e) => marcarItem(item.id, "cargado", e.target.checked)} />
                    Cargado
                  </label>
                )}
                {faseDescarga && (
                  <label className="check-inline">
                    <input type="checkbox" checked={item.entregado} disabled={busy} onChange={(e) => marcarItem(item.id, "entregado", e.target.checked)} />
                    Entregado
                  </label>
                )}
              </li>
            ))}
          </ul>
        </div>

        {esCliente && s.estado === "completada" && (
          <div className="card">
            <h3>Calificá a {s.fleteroNombre}</h3>
            {s.resenada ? (
              <div className="alert ok">Ya calificaste este flete. ¡Gracias!</div>
            ) : (
              <ReviewForm
                solicitudId={s.id}
                fleteroId={s.fleteroId}
                onSubmitted={() => {
                  toast.success("¡Gracias por tu calificación!");
                  load();
                }}
              />
            )}
          </div>
        )}
      </div>

      <div className="grid" style={{ gap: 20, alignContent: "start" }}>
        <div className="card">
          <div className="spread" style={{ marginBottom: 8 }}>
            <h3 style={{ margin: 0 }}>Recorrido</h3>
            {s.distanciaRecorridoKm != null && <span className="muted">{s.distanciaRecorridoKm} km</span>}
          </div>
          <div className="ruta-mini" style={{ marginBottom: 10 }}>
            <div><b>Origen:</b> {s.origenDireccion || "Sin dirección"}</div>
            <div><b>Destino:</b> {s.destinoDireccion || "Sin dirección"}</div>
          </div>
          <MapView
            center={[s.origenLat, s.origenLng]}
            route={{
              origen: { lat: s.origenLat, lng: s.origenLng, label: s.origenDireccion },
              destino: { lat: s.destinoLat, lng: s.destinoLng, label: s.destinoDireccion }
            }}
          />
        </div>

        <div className="card">
          {esCliente ? (
            <>
              <div className="spread" style={{ marginBottom: 8 }}>
                <h3 style={{ margin: 0 }}>
                  {s.estado === "publicada" ? `Presupuestos (${presupuestos.length})` : "Presupuesto elegido"}
                </h3>
                {s.estado === "publicada" && presupuestos.length > 1 && (
                  <select value={orden} onChange={(e) => setOrden(e.target.value)} style={{ width: "auto" }} aria-label="Ordenar presupuestos">
                    <option value="monto">Menor precio</option>
                    <option value="calificacion">Mejor calificación</option>
                  </select>
                )}
              </div>
              {s.estado === "publicada" && presupuestos.length === 0 && (
                <div className="empty">Sin presupuestos.</div>
              )}
              {presupuestos
                .filter((p) => s.estado === "publicada" || p.id === s.presupuestoId)
                .map((p) => (
                  <div key={p.id} className="presupuesto">
                    <div className="spread" style={{ alignItems: "flex-start" }}>
                      <div>
                        <Link className="link" to={`/fletero/${p.fleteroId}`} style={{ fontWeight: 700 }}>
                          {p.fletero?.nombre}
                        </Link>
                        <div>
                          <StarsDisplay value={p.fletero?.promedioCalificacion || 0} count={p.fletero?.cantidadResenas} />
                        </div>
                        <div className="muted">
                          {VEHICULO_LABEL[p.fletero?.tipoVehiculo]} · {p.fletero?.fletesCompletados} fletes completados
                        </div>
                      </div>
                      <span className="tag-price" style={{ fontSize: 18 }}>{formatPrecio(p.monto)}</span>
                    </div>
                    {p.mensaje && <p style={{ margin: "8px 0" }}>{p.mensaje}</p>}
                    <div className="row">
                      <button type="button" className="btn ghost sm" onClick={() => setChatCon(p.fleteroId)}>
                        Chatear
                      </button>
                      {s.estado === "publicada" && (
                        <button
                          type="button"
                          className="btn success sm"
                          disabled={busy}
                          onClick={() =>
                            setConfirmar({
                              title: `¿Elegir a ${p.fletero?.nombre}?`,
                              message: formatPrecio(p.monto),
                              confirmLabel: "Elegir presupuesto",
                              action: () => run(() => api.post(`/solicitudes/${id}/presupuestos/${p.id}/aceptar`), "¡Flete confirmado!")
                            })
                          }
                        >
                          Elegir
                        </button>
                      )}
                    </div>
                  </div>
                ))}
            </>
          ) : (
            <>
              <h3>Tu presupuesto</h3>
              {s.estado === "publicada" ? (
                <PresupuestoForm
                  solicitud={s}
                  onSaved={(next, nuevo) => {
                    setS(next);
                    toast.success(nuevo ? "Presupuesto enviado." : "Presupuesto actualizado.");
                  }}
                />
              ) : otroElegido ? (
                <div className="alert info">El cliente eligió otro presupuesto.</div>
              ) : (
                <p style={{ margin: 0 }}>
                  Presupuesto aceptado: <span className="tag-price">{formatPrecio(s.precioAcordado)}</span>
                </p>
              )}
            </>
          )}
        </div>

        <div className="card">
          <h3>Chat{chatActivo ? ` con ${chatActivo.nombre}` : ""}</h3>
          {esCliente && conversaciones.length > 1 && (
            <div className="chips" style={{ marginBottom: 10 }}>
              {conversaciones.map((c) => (
                <button
                  key={c.fleteroId}
                  type="button"
                  className={`chip oficio ${chatActivo?.fleteroId === c.fleteroId ? "chip-active" : ""}`}
                  onClick={() => setChatCon(c.fleteroId)}
                >
                  {c.nombre}
                </button>
              ))}
            </div>
          )}
          {chatActivo ? (
            <ChatPanel solicitudId={s.id} fleteroId={chatActivo.fleteroId} otroNombre={chatActivo.nombre} />
          ) : (
            <div className="empty">
              {esCliente ? "Sin conversaciones." : "Disponible al enviar un presupuesto."}
            </div>
          )}
        </div>
      </div>

      {confirmar && (
        <ConfirmDialog
          title={confirmar.title}
          message={confirmar.message}
          confirmLabel={confirmar.confirmLabel}
          cancelLabel="Volver"
          onCancel={() => setConfirmar(null)}
          onConfirm={() => {
            const { action } = confirmar;
            setConfirmar(null);
            action();
          }}
        />
      )}
    </div>
  );
}
