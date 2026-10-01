import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../services/api.js";
import MapSearchModal from "../components/MapSearchModal.jsx";
import MapView from "../components/MapView.jsx";
import FotosInput from "../components/FotosInput.jsx";
import { MapPinIcon, PlusIcon, TrashIcon } from "../components/Icons.jsx";
import { TIPOS_CARGA, VEHICULOS, CENTRO_TUCUMAN } from "../utils/catalogos.js";
import { toDatetimeLocal } from "../utils/format.js";

const VACIA = {
  titulo: "",
  tipoCarga: "mudanza",
  descripcion: "",
  origenDireccion: "",
  origenLat: null,
  origenLng: null,
  destinoDireccion: "",
  destinoLat: null,
  destinoLng: null,
  fecha: "",
  tipoVehiculo: "",
  fotos: [],
  inventario: [{ nombre: "", cantidad: 1, fotoUrl: "" }]
};

// Publicar (o editar, mientras siga publicada) una solicitud de flete.
export default function NuevaSolicitud() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [form, setForm] = useState(id ? null : VACIA);
  const [picker, setPicker] = useState(null); // "origen" | "destino"
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!id) return;
    api
      .get(`/solicitudes/${id}`)
      .then((s) =>
        setForm({
          ...VACIA,
          ...s,
          fecha: toDatetimeLocal(s.fecha),
          tipoVehiculo: s.tipoVehiculo || "",
          inventario: s.inventario.length ? s.inventario : VACIA.inventario
        })
      )
      .catch(() => navigate("/panel"));
  }, [id, navigate]);

  if (!form) return <div className="modal-loading"><span className="spinner" /> Cargando solicitud…</div>;

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  function setItem(i, k, v) {
    const inventario = form.inventario.slice();
    inventario[i] = { ...inventario[i], [k]: v };
    setForm({ ...form, inventario });
  }

  function validate() {
    const errs = {};
    if (!form.titulo.trim()) errs.titulo = "Falta el título.";
    if (form.origenLat == null) errs.origen = "Falta el origen.";
    if (form.destinoLat == null) errs.destino = "Falta el destino.";
    if (form.inventario.some((i) => !i.nombre.trim())) errs.inventario = "Hay objetos sin nombre.";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function submit(e) {
    e.preventDefault();
    if (!validate()) return;
    setBusy(true);
    const payload = {
      ...form,
      fecha: form.fecha ? new Date(form.fecha).toISOString() : null,
      tipoVehiculo: form.tipoVehiculo || null,
      inventario: form.inventario.map((i) => ({ ...i, cantidad: Number(i.cantidad) || 1 }))
    };
    try {
      const s = id ? await api.put(`/solicitudes/${id}`, payload) : await api.post("/solicitudes", payload);
      navigate(`/solicitud/${s.id}`);
    } catch {
      // El toast global ya avisó del error.
    } finally {
      setBusy(false);
    }
  }

  const origen = form.origenLat != null ? { lat: form.origenLat, lng: form.origenLng, label: form.origenDireccion } : null;
  const destino = form.destinoLat != null ? { lat: form.destinoLat, lng: form.destinoLng, label: form.destinoDireccion } : null;

  function PuntoField({ tipo, punto }) {
    const dirKey = `${tipo}Direccion`;
    return (
      <div className="field">
        <label>{tipo === "origen" ? "Origen" : "Destino"}</label>
        <div className="punto-field">
          <input
            value={form[dirKey]}
            onChange={set(dirKey)}
            placeholder="Dirección"
          />
          <button type="button" className={`btn sm ${punto ? "ghost" : ""}`} onClick={() => setPicker(tipo)}>
            <MapPinIcon /> {punto ? "Cambiar" : "Mapa"}
          </button>
        </div>
        {errors[tipo] && <div className="field-error">{errors[tipo]}</div>}
      </div>
    );
  }

  return (
    <div className="panel-page">
      <div className="panel-header">
        <h1 className="section-title" style={{ margin: 0 }}>{id ? "Editar solicitud" : "Publicar flete"}</h1>
      </div>

      <form onSubmit={submit} noValidate className="grid cols-2">
        <div className="grid" style={{ gap: 20, alignContent: "start" }}>
          <div className="card">
            <h3>Carga</h3>
            <div className="field">
              <label>Título</label>
              <input value={form.titulo} onChange={set("titulo")} placeholder="Ej: Mudanza 2 ambientes" autoFocus />
              {errors.titulo && <div className="field-error">{errors.titulo}</div>}
            </div>
            <div className="grid cols-2" style={{ gap: 12 }}>
              <div className="field">
                <label>Tipo de carga</label>
                <select value={form.tipoCarga} onChange={set("tipoCarga")}>
                  {TIPOS_CARGA.map((t) => (
                    <option key={t.id} value={t.id}>{t.label}</option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>Vehículo preferido</label>
                <select value={form.tipoVehiculo} onChange={set("tipoVehiculo")}>
                  <option value="">Cualquiera</option>
                  {VEHICULOS.map((v) => (
                    <option key={v.id} value={v.id}>{v.label}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="field">
              <label>Detalles</label>
              <textarea
                value={form.descripcion}
                onChange={set("descripcion")}
                placeholder="Pisos, escaleras, objetos frágiles…"
              />
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label>Fotos</label>
              <FotosInput value={form.fotos} onChange={(fotos) => setForm((f) => ({ ...f, fotos }))} />
            </div>
          </div>

          <div className="card">
            <div className="spread" style={{ marginBottom: 8 }}>
              <h3 style={{ margin: 0 }}>Inventario</h3>
              <button
                type="button"
                className="btn ghost sm"
                onClick={() => setForm({ ...form, inventario: [...form.inventario, { nombre: "", cantidad: 1, fotoUrl: "" }] })}
              >
                <PlusIcon /> Agregar objeto
              </button>
            </div>
            {form.inventario.length === 0 && <div className="empty">Sin objetos.</div>}
            <div className="inventario-edit">
              {form.inventario.map((item, i) => (
                <div className="inventario-edit-row" key={item.id || i}>
                  <FotosInput
                    max={1}
                    label="Foto"
                    value={item.fotoUrl ? [item.fotoUrl] : []}
                    onChange={(fotos) => setItem(i, "fotoUrl", fotos[0] || "")}
                  />
                  <input
                    value={item.nombre}
                    onChange={(e) => setItem(i, "nombre", e.target.value)}
                    placeholder="Objeto (ej: Heladera)"
                    aria-label={`Objeto ${i + 1}`}
                  />
                  <input
                    type="number"
                    min="1"
                    value={item.cantidad}
                    onChange={(e) => setItem(i, "cantidad", e.target.value)}
                    aria-label={`Cantidad del objeto ${i + 1}`}
                    className="inventario-cantidad"
                  />
                  <button
                    type="button"
                    className="btn ghost sm"
                    onClick={() => setForm({ ...form, inventario: form.inventario.filter((_, idx) => idx !== i) })}
                    aria-label={`Quitar objeto ${i + 1}`}
                  >
                    <TrashIcon />
                  </button>
                </div>
              ))}
            </div>
            {errors.inventario && <div className="field-error">{errors.inventario}</div>}
          </div>
        </div>

        <div className="grid" style={{ gap: 20, alignContent: "start" }}>
          <div className="card">
            <h3>Recorrido y fecha</h3>
            {PuntoField({ tipo: "origen", punto: origen })}
            {PuntoField({ tipo: "destino", punto: destino })}
            <div className="field">
              <label>Fecha y hora (opcional)</label>
              <input type="datetime-local" value={form.fecha} onChange={set("fecha")} />
            </div>
            {(origen || destino) && (
              <MapView
                key={`${form.origenLat},${form.origenLng},${form.destinoLat},${form.destinoLng}`}
                center={origen ? [origen.lat, origen.lng] : [destino.lat, destino.lng]}
                zoom={12}
                route={{ origen, destino }}
              />
            )}
          </div>

          <div className="row" style={{ justifyContent: "flex-end" }}>
            <button type="button" className="btn ghost" onClick={() => navigate(-1)}>Cancelar</button>
            <button className="btn gold" disabled={busy}>
              {busy ? "Guardando…" : id ? "Guardar" : "Publicar"}
            </button>
          </div>
        </div>
      </form>

      {picker && (
        <MapSearchModal
          initialCenter={
            picker === "origen"
              ? origen && [origen.lat, origen.lng]
              : (destino && [destino.lat, destino.lng]) || (origen && [origen.lat, origen.lng]) || CENTRO_TUCUMAN
          }
          eyebrow={picker === "origen" ? "Origen" : "Destino"}
          title={picker === "origen" ? "Origen" : "Destino"}
          confirmLabel="Usar este punto"
          onClose={() => setPicker(null)}
          onConfirm={(lat, lng) =>
            setForm((f) => ({ ...f, [`${picker}Lat`]: lat, [`${picker}Lng`]: lng }))
          }
        />
      )}
    </div>
  );
}
