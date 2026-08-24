import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../services/api.js";
import { useAuth } from "../hooks/useAuth.js";
import MapView from "../components/MapView.jsx";
import { EditIcon, ImageIcon, MapPinIcon, PlusIcon, TrashIcon } from "../components/Icons.jsx";

const DEFAULT_CENTER = [-34.9011, -56.1645];
const MAX_PHOTO_BYTES = 3 * 1024 * 1024;

const TABS = [
  { id: "datos", label: "Datos y tarifa" },
  { id: "ubicacion", label: "Ubicación" },
  { id: "portafolio", label: "Portafolio" }
];

function splitName(fullName) {
  const parts = String(fullName || "").trim().split(/\s+/).filter(Boolean);
  return { nombre: parts[0] || "", apellido: parts.slice(1).join(" ") };
}

export default function EditPlumberProfile({ onDone, onDirtyChange }) {
  const { user, plumberId, refresh } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState(null);
  const [tab, setTab] = useState("datos");
  const [photoError, setPhotoError] = useState("");
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [dispBusy, setDispBusy] = useState(false);
  const fileInputRef = useRef(null);
  const initialSnapshot = useRef(null);

  useEffect(() => {
    if (user && user.role !== "plomero" && !onDone) navigate("/panel");
  }, [user, navigate, onDone]);

  useEffect(() => {
    if (!plumberId) return;
    api.get(`/plumbers/${plumberId}`).then((p) => {
      const next = {
        ...splitName(user.name),
        especialidad: (p.especialidad || []).join(", "),
        descripcion: p.descripcion || "",
        hourlyRate: p.hourlyRate || 0,
        address: p.address || "",
        radioTrabajoKm: p.radioTrabajoKm || 10,
        fotoUrl: p.fotoUrl || "",
        disponible: !!p.disponible,
        latitud: p.latitud,
        longitud: p.longitud,
        portfolio: p.portfolio || []
      };
      initialSnapshot.current = JSON.stringify(next);
      setForm(next);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plumberId]);

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

  function pick(lat, lng) {
    setForm({ ...form, latitud: lat, longitud: lng });
  }

  function addPortfolio() {
    setForm({ ...form, portfolio: [...form.portfolio, { title: "", imageUrl: "", description: "" }] });
  }
  function updatePortfolio(i, k, v) {
    const p = form.portfolio.slice();
    p[i] = { ...p[i], [k]: v };
    setForm({ ...form, portfolio: p });
  }
  function removePortfolio(i) {
    setForm({ ...form, portfolio: form.portfolio.filter((_, idx) => idx !== i) });
  }

  function onPhotoChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoError("");
    if (!file.type.startsWith("image/")) {
      setPhotoError("Elegí un archivo de imagen válido.");
      return;
    }
    if (file.size > MAX_PHOTO_BYTES) {
      setPhotoError("La imagen no puede superar los 3 MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setForm((f) => ({ ...f, fotoUrl: reader.result }));
    reader.onerror = () => setPhotoError("No se pudo leer la imagen.");
    reader.readAsDataURL(file);
  }

  function removePhoto() {
    setForm({ ...form, fotoUrl: "" });
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setMsg("");
    try {
      const fullName = `${form.nombre} ${form.apellido}`.trim();
      await Promise.all([
        api.put(`/plumbers/${plumberId}`, {
          especialidad: form.especialidad.split(",").map((s) => s.trim()).filter(Boolean),
          descripcion: form.descripcion,
          hourlyRate: Number(form.hourlyRate),
          address: form.address,
          radioTrabajoKm: Number(form.radioTrabajoKm),
          fotoUrl: form.fotoUrl,
          latitud: form.latitud,
          longitud: form.longitud,
          portfolio: form.portfolio.filter((p) => p.title)
        }),
        api.put("/auth/me", { name: fullName })
      ]);
      await refresh();
      initialSnapshot.current = JSON.stringify(form);
      onDirtyChange?.(false);
      setMsg("Perfil guardado correctamente.");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function toggleDisponibilidad() {
    const next = !form.disponible;
    setDispBusy(true);
    setError("");
    try {
      const updated = await api.patch(`/plumbers/${plumberId}/disponibilidad`, { disponible: next });
      setForm((f) => ({ ...f, disponible: updated.disponible }));
    } catch (err) {
      setError(err.message);
    } finally {
      setDispBusy(false);
    }
  }

  const center = form.latitud != null ? [form.latitud, form.longitud] : DEFAULT_CENTER;

  return (
    <form onSubmit={save} className="profile-editor">
      <div className="profile-editor-top">
        <div className="profile-avatar-block">
          <div className="avatar-upload">
            <img
              className="avatar avatar-lg"
              src={form.fotoUrl || `https://i.pravatar.cc/150?u=${plumberId}`}
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
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={onPhotoChange}
              style={{ display: "none" }}
            />
          </div>
          <div>
            <div className="profile-name">{`${form.nombre} ${form.apellido}`.trim() || user.name}</div>
            {form.fotoUrl && (
              <button type="button" className="link-danger" onClick={removePhoto}>
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
              {form.disponible ? "Visible para nuevos trabajos" : "No disponible"}
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

      {error && <div className="alert error">{error}</div>}
      {msg && <div className="alert ok">{msg}</div>}

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
          <label>Especialidad (separada por coma)</label>
          <input value={form.especialidad} onChange={set("especialidad")} placeholder="Plomería, Gasista" />
        </div>
        <div className="field">
          <label>Descripción / experiencia</label>
          <textarea value={form.descripcion} onChange={set("descripcion")} />
        </div>
        <div className="grid cols-2" style={{ gap: 12 }}>
          <div className="field">
            <label>Tarifa referencia ($/h)</label>
            <input type="number" value={form.hourlyRate} onChange={set("hourlyRate")} />
          </div>
          <div className="field">
            <label>Radio de trabajo (km)</label>
            <input type="number" min="0" value={form.radioTrabajoKm} onChange={set("radioTrabajoKm")} />
          </div>
        </div>
        <div className="field" style={{ marginBottom: 0 }}>
          <label>Barrio / dirección de referencia</label>
          <input value={form.address} onChange={set("address")} />
        </div>
      </div>

      <div className="modal-tab-panel" hidden={tab !== "ubicacion"}>
        <p className="muted" style={{ marginTop: 0, display: "flex", gap: 6, alignItems: "center" }}>
          <MapPinIcon /> Hacé clic en el mapa para fijar tu zona. El círculo muestra tu radio de {form.radioTrabajoKm} km.
        </p>
        <MapView
          center={center}
          zoom={12}
          onPick={pick}
          me={form.latitud != null ? { lat: form.latitud, lng: form.longitud, label: "Tu ubicación" } : null}
          pickCoverageKm={Number(form.radioTrabajoKm) || null}
        />
        {form.latitud != null && (
          <p className="muted" style={{ marginTop: 8, marginBottom: 0 }}>
            Coordenadas: {form.latitud.toFixed(4)}, {form.longitud.toFixed(4)}
          </p>
        )}
      </div>

      <div className="modal-tab-panel" hidden={tab !== "portafolio"}>
        <div className="spread" style={{ marginBottom: 4 }}>
          <p className="muted" style={{ margin: 0 }}>Mostrá fotos de trabajos anteriores para generar confianza.</p>
          <button type="button" className="btn ghost sm" onClick={addPortfolio}>
            <PlusIcon /> Agregar
          </button>
        </div>
        {form.portfolio.length === 0 && (
          <div className="portfolio-empty">
            <ImageIcon />
            <span>Todavía no agregaste trabajos.</span>
          </div>
        )}
        <div className="portfolio-edit-grid">
          {form.portfolio.map((p, i) => (
            <div key={i} className="portfolio-edit-item">
              <div className="portfolio-edit-preview">
                {p.imageUrl ? (
                  <img src={p.imageUrl} alt={p.title} />
                ) : (
                  <div className="portfolio-edit-placeholder"><ImageIcon /></div>
                )}
                <button type="button" className="portfolio-edit-remove" onClick={() => removePortfolio(i)} aria-label="Quitar trabajo">
                  <TrashIcon />
                </button>
              </div>
              <div className="field">
                <label>Título</label>
                <input value={p.title} onChange={(e) => updatePortfolio(i, "title", e.target.value)} />
              </div>
              <div className="field">
                <label>URL de imagen</label>
                <input value={p.imageUrl} onChange={(e) => updatePortfolio(i, "imageUrl", e.target.value)} />
              </div>
              <div className="field" style={{ marginBottom: 0 }}>
                <label>Descripción</label>
                <input value={p.description} onChange={(e) => updatePortfolio(i, "description", e.target.value)} />
              </div>
            </div>
          ))}
        </div>
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
