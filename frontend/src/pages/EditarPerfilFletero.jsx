import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../services/api.js";
import { useAuth } from "../hooks/useAuth.js";
import { useToast } from "../context/ToastContext.jsx";
import MapView from "../components/MapView.jsx";
import FotosInput from "../components/FotosInput.jsx";
import { EditIcon, MapPinIcon } from "../components/Icons.jsx";
import { imagenADataUrl } from "../utils/imagenes.js";
import { CENTRO_TUCUMAN, VEHICULOS } from "../utils/catalogos.js";

const TABS = [
  { id: "datos", label: "Datos y tarifa" },
  { id: "vehiculo", label: "Vehículo" },
  { id: "zona", label: "Zona de trabajo" }
];

function splitName(fullName) {
  const parts = String(fullName || "").trim().split(/\s+/).filter(Boolean);
  return { nombre: parts[0] || "", apellido: parts.slice(1).join(" ") };
}

export default function EditarPerfilFletero({ onDone, onDirtyChange }) {
  const { usuario, fleteroId, refresh } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [form, setForm] = useState(null);
  const [tab, setTab] = useState("datos");
  const [photoError, setPhotoError] = useState("");
  const [busy, setBusy] = useState(false);
  const [dispBusy, setDispBusy] = useState(false);
  const fileInputRef = useRef(null);
  const initialSnapshot = useRef(null);

  useEffect(() => {
    if (usuario && usuario.rol !== "fletero" && !onDone) navigate("/panel");
  }, [usuario, navigate, onDone]);

  useEffect(() => {
    if (!fleteroId) return;
    api
      .get(`/fleteros/${fleteroId}`)
      .then((f) => {
        const next = {
          ...splitName(usuario.nombre),
          descripcion: f.descripcion || "",
          tarifaBase: f.tarifaBase || 0,
          tipoVehiculo: f.tipoVehiculo,
          vehiculoDescripcion: f.vehiculoDescripcion || "",
          capacidadKg: f.capacidadKg ?? "",
          fotoVehiculoUrl: f.fotoVehiculoUrl || "",
          direccion: f.direccion || "",
          radioTrabajoKm: f.radioTrabajoKm || 10,
          fotoUrl: f.fotoUrl || "",
          disponible: !!f.disponible,
          latitud: f.latitud,
          longitud: f.longitud
        };
        initialSnapshot.current = JSON.stringify(next);
        setForm(next);
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fleteroId]);

  useEffect(() => {
    if (!form || !initialSnapshot.current || !onDirtyChange) return;
    onDirtyChange(JSON.stringify(form) !== initialSnapshot.current);
  }, [form, onDirtyChange]);

  if (!form) {
    return (
      <div className="modal-loading">
        <span className="spinner" />
        Cargando tu perfil…
      </div>
    );
  }

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function onPhotoChange(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setPhotoError("");
    try {
      const fotoUrl = await imagenADataUrl(file);
      setForm((f) => ({ ...f, fotoUrl }));
    } catch (err) {
      setPhotoError(err.message);
    }
  }

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    try {
      const fullName = `${form.nombre} ${form.apellido}`.trim();
      await Promise.all([
        api.put(`/fleteros/${fleteroId}`, {
          descripcion: form.descripcion,
          tarifaBase: Number(form.tarifaBase),
          tipoVehiculo: form.tipoVehiculo,
          vehiculoDescripcion: form.vehiculoDescripcion,
          capacidadKg: form.capacidadKg,
          fotoVehiculoUrl: form.fotoVehiculoUrl,
          direccion: form.direccion,
          radioTrabajoKm: Number(form.radioTrabajoKm),
          fotoUrl: form.fotoUrl,
          latitud: form.latitud,
          longitud: form.longitud
        }),
        api.put("/auth/me", { nombre: fullName })
      ]);
      await refresh();
      initialSnapshot.current = JSON.stringify(form);
      onDirtyChange?.(false);
      window.dispatchEvent(new Event("perfil:actualizado"));
      toast.success("Perfil guardado correctamente.");
    } catch {
      // El toast global ya avisó del error.
    } finally {
      setBusy(false);
    }
  }

  async function toggleDisponibilidad() {
    setDispBusy(true);
    try {
      const updated = await api.patch(`/fleteros/${fleteroId}/disponibilidad`, { disponible: !form.disponible });
      setForm((f) => ({ ...f, disponible: updated.disponible }));
      window.dispatchEvent(new Event("perfil:actualizado"));
    } catch {
      // El toast global ya avisó del error.
    } finally {
      setDispBusy(false);
    }
  }

  const center = form.latitud != null ? [form.latitud, form.longitud] : CENTRO_TUCUMAN;

  return (
    <form onSubmit={save} className="profile-editor">
      <div className="profile-editor-top">
        <div className="profile-avatar-block">
          <div className="avatar-upload">
            <img
              className="avatar avatar-lg"
              src={form.fotoUrl || `https://i.pravatar.cc/150?u=${fleteroId}`}
              alt="Vista previa de foto de perfil"
            />
            <button
              type="button"
              className="avatar-upload-hit"
              onClick={() => fileInputRef.current?.click()}
              aria-label="Cambiar foto de perfil"
            >
              <EditIcon />
              <span>Cambiar</span>
            </button>
            <input ref={fileInputRef} type="file" accept="image/*" onChange={onPhotoChange} hidden />
          </div>
          <div>
            <div className="profile-name">{`${form.nombre} ${form.apellido}`.trim() || usuario.nombre}</div>
            {form.fotoUrl && (
              <button type="button" className="link-danger" onClick={() => setForm({ ...form, fotoUrl: "" })}>
                Quitar foto
              </button>
            )}
            {photoError && <div className="field-error">{photoError}</div>}
          </div>
        </div>

        <div className="avail-toggle">
          <div>
            <div className="avail-title">Disponibilidad</div>
            <p className="muted" style={{ margin: 0 }}>
              {form.disponible ? "Recibiendo solicitudes" : "No disponible"}
            </p>
          </div>
          <button
            type="button"
            className={`switch ${form.disponible ? "on" : ""}`}
            role="switch"
            aria-checked={form.disponible}
            aria-label="Alternar disponibilidad"
            disabled={dispBusy}
            onClick={toggleDisponibilidad}
          >
            <span className="switch-knob" />
          </button>
        </div>
      </div>

      <div className="modal-tabs" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            className={`modal-tab ${tab === t.id ? "active" : ""}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="modal-tab-panel" hidden={tab !== "datos"}>
        <div className="grid cols-2" style={{ gap: 12 }}>
          <div className="field">
            <label>Nombre</label>
            <input value={form.nombre} onChange={set("nombre")} placeholder="Tu nombre" required />
          </div>
          <div className="field">
            <label>Apellido</label>
            <input value={form.apellido} onChange={set("apellido")} placeholder="Tu apellido" />
          </div>
        </div>
        <div className="field">
          <label>Descripción</label>
          <textarea
            value={form.descripcion}
            onChange={set("descripcion")}
            placeholder="Descripción"
          />
        </div>
        <div className="field" style={{ marginBottom: 0 }}>
          <label>Tarifa base ($)</label>
          <input type="number" min="0" value={form.tarifaBase} onChange={set("tarifaBase")} />
        </div>
      </div>

      <div className="modal-tab-panel" hidden={tab !== "vehiculo"}>
        <div className="field">
          <label>Tipo de vehículo</label>
          <select value={form.tipoVehiculo} onChange={set("tipoVehiculo")}>
            {VEHICULOS.map((v) => (
              <option key={v.id} value={v.id}>{v.label}</option>
            ))}
          </select>
        </div>
        <div className="grid cols-2" style={{ gap: 12 }}>
          <div className="field">
            <label>Marca / modelo / detalles</label>
            <input value={form.vehiculoDescripcion} onChange={set("vehiculoDescripcion")} placeholder="Ej: Ford Ranger caja abierta" />
          </div>
          <div className="field">
            <label>Capacidad aprox. (kg)</label>
            <input type="number" min="0" value={form.capacidadKg} onChange={set("capacidadKg")} placeholder="Opcional" />
          </div>
        </div>
        <div className="field" style={{ marginBottom: 0 }}>
          <label>Foto del vehículo</label>
          <FotosInput
            max={1}
            label="Subir foto"
            value={form.fotoVehiculoUrl ? [form.fotoVehiculoUrl] : []}
            onChange={(fotos) => setForm((f) => ({ ...f, fotoVehiculoUrl: fotos[0] || "" }))}
          />
        </div>
      </div>

      <div className="modal-tab-panel" hidden={tab !== "zona"}>
        <div className="grid cols-2" style={{ gap: 12 }}>
          <div className="field">
            <label>Barrio / dirección de referencia</label>
            <input value={form.direccion} onChange={set("direccion")} placeholder="Ej: Barrio Norte, San Miguel de Tucumán" />
          </div>
          <div className="field">
            <label>Radio de trabajo (km)</label>
            <input type="number" min="1" value={form.radioTrabajoKm} onChange={set("radioTrabajoKm")} />
          </div>
        </div>
        <p className="muted" style={{ marginTop: 0, display: "flex", gap: 6, alignItems: "center" }}>
          <MapPinIcon /> Tocá el mapa para marcar tu ubicación.
        </p>
        {tab === "zona" && (
          <MapView
            center={center}
            zoom={11}
            onPick={(lat, lng) => setForm((f) => ({ ...f, latitud: lat, longitud: lng }))}
            me={form.latitud != null ? { lat: form.latitud, lng: form.longitud, label: "Tu ubicación" } : null}
            pickCoverageKm={Number(form.radioTrabajoKm) || null}
          />
        )}
        {form.latitud != null && (
          <p className="muted" style={{ marginTop: 8, marginBottom: 0 }}>
            Coordenadas: {form.latitud.toFixed(4)}, {form.longitud.toFixed(4)}
          </p>
        )}
      </div>

      <div className="modal-footer">
        <button type="button" className="btn ghost" onClick={() => (onDone ? onDone() : navigate("/panel"))}>
          Cancelar
        </button>
        <button className="btn gold" disabled={busy}>{busy ? "Guardando…" : "Guardar perfil"}</button>
      </div>
    </form>
  );
}
