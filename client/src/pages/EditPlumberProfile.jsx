import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../services/api.js";
import { useAuth } from "../hooks/useAuth.js";
import MapView from "../components/MapView.jsx";

const DEFAULT_CENTER = [-34.9011, -56.1645];
const MAX_PHOTO_BYTES = 3 * 1024 * 1024;

export default function EditPlumberProfile() {
  const { user, plumberId } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState(null);
  const [photoError, setPhotoError] = useState("");
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [dispBusy, setDispBusy] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (user && user.role !== "plomero") navigate("/panel");
  }, [user, navigate]);

  useEffect(() => {
    if (!plumberId) return;
    api.get(`/plumbers/${plumberId}`).then((p) => {
      setForm({
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
      });
    });
  }, [plumberId]);

  if (!form) return <div>Cargando…</div>;

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
      await api.put(`/plumbers/${plumberId}`, {
        especialidad: form.especialidad.split(",").map((s) => s.trim()).filter(Boolean),
        descripcion: form.descripcion,
        hourlyRate: Number(form.hourlyRate),
        address: form.address,
        radioTrabajoKm: Number(form.radioTrabajoKm),
        fotoUrl: form.fotoUrl,
        latitud: form.latitud,
        longitud: form.longitud,
        portfolio: form.portfolio.filter((p) => p.title)
      });
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
    <div>
      <h2 className="section-title">Mi perfil de plomero</h2>
      {error && <div className="alert error">{error}</div>}
      {msg && <div className="alert ok">{msg}</div>}

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="spread">
          <div>
            <h3 style={{ margin: "0 0 4px" }}>Disponibilidad</h3>
            <p className="muted" style={{ margin: 0 }}>
              {form.disponible ? "Estás visible como disponible para nuevos trabajos." : "Estás marcado como no disponible."}
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

      <form onSubmit={save} className="grid cols-2">
        <div className="card">
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
          <div className="field">
            <label>Barrio / dirección de referencia</label>
            <input value={form.address} onChange={set("address")} />
          </div>

          <div className="field">
            <label>Foto de perfil</label>
            <div className="photo-upload">
              <img
                className="avatar"
                style={{ width: 72, height: 72 }}
                src={form.fotoUrl || `https://i.pravatar.cc/150?u=${plumberId}`}
                alt="Vista previa de foto de perfil"
              />
              <div className="photo-upload-actions">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={onPhotoChange}
                  style={{ display: "none" }}
                  id="photo-input"
                />
                <button type="button" className="btn ghost sm" onClick={() => fileInputRef.current?.click()}>
                  Subir foto
                </button>
                {form.fotoUrl && (
                  <button type="button" className="btn danger sm" onClick={removePhoto}>
                    Quitar
                  </button>
                )}
              </div>
            </div>
            {photoError && <div className="field-error">{photoError}</div>}
          </div>

          <button className="btn" disabled={busy}>{busy ? "Guardando…" : "Guardar perfil"}</button>
        </div>

        <div className="card">
          <h3>Ubicación base</h3>
          <p className="muted" style={{ marginTop: -6 }}>
            Hacé clic en el mapa para fijar tu zona. El círculo muestra tu radio de trabajo de {form.radioTrabajoKm} km.
          </p>
          <MapView
            center={center}
            zoom={12}
            onPick={pick}
            me={form.latitud != null ? { lat: form.latitud, lng: form.longitud, label: "Tu ubicación" } : null}
            pickCoverageKm={Number(form.radioTrabajoKm) || null}
          />
          {form.latitud != null && (
            <p className="muted" style={{ marginTop: 8 }}>
              Coordenadas: {form.latitud.toFixed(4)}, {form.longitud.toFixed(4)}
            </p>
          )}
        </div>

        <div className="card" style={{ gridColumn: "1 / -1" }}>
          <div className="spread">
            <h3 style={{ margin: 0 }}>Portafolio</h3>
            <button type="button" className="btn ghost sm" onClick={addPortfolio}>+ Agregar trabajo</button>
          </div>
          {form.portfolio.length === 0 && <p className="muted">Agregá fotos de trabajos anteriores.</p>}
          {form.portfolio.map((p, i) => (
            <div key={i} className="grid cols-2" style={{ gap: 12, alignItems: "start", marginTop: 12 }}>
              <div>
                <div className="field">
                  <label>Título</label>
                  <input value={p.title} onChange={(e) => updatePortfolio(i, "title", e.target.value)} />
                </div>
                <div className="field">
                  <label>URL de imagen</label>
                  <input value={p.imageUrl} onChange={(e) => updatePortfolio(i, "imageUrl", e.target.value)} />
                </div>
                <div className="field">
                  <label>Descripción</label>
                  <input value={p.description} onChange={(e) => updatePortfolio(i, "description", e.target.value)} />
                </div>
                <button type="button" className="btn danger sm" onClick={() => removePortfolio(i)}>Quitar</button>
              </div>
              <div>
                {p.imageUrl && <img src={p.imageUrl} alt={p.title} style={{ width: "100%", borderRadius: 10, maxHeight: 200, objectFit: "cover" }} />}
              </div>
            </div>
          ))}
        </div>
      </form>
    </div>
  );
}
