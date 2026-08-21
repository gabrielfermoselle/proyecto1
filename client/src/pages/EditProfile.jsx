import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../services/api.js";
import { useAuth } from "../hooks/useAuth.js";
import MapView from "../components/MapView.jsx";

const DEFAULT_CENTER = [-34.9011, -56.1645];

export default function EditProfile() {
  const { user, workerId } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState(null);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (user && user.role !== "worker") navigate("/panel");
  }, [user, navigate]);

  useEffect(() => {
    if (!workerId) return;
    api.get(`/workers/${workerId}`).then((w) => {
      setForm({
        oficios: (w.oficios || []).join(", "),
        bio: w.bio || "",
        hourlyRate: w.hourlyRate || 0,
        address: w.address || "",
        coverageKm: w.coverageKm || 10,
        photoUrl: w.photoUrl || "",
        lat: w.lat,
        lng: w.lng,
        portfolio: w.portfolio || []
      });
    });
  }, [workerId]);

  if (!form) return <div>Cargando…</div>;

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  function pick(lat, lng) {
    setForm({ ...form, lat, lng });
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

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setMsg("");
    try {
      await api.put("/workers/me/profile", {
        oficios: form.oficios.split(",").map((s) => s.trim()).filter(Boolean),
        bio: form.bio,
        hourlyRate: Number(form.hourlyRate),
        address: form.address,
        coverageKm: Number(form.coverageKm),
        photoUrl: form.photoUrl,
        lat: form.lat,
        lng: form.lng,
        portfolio: form.portfolio.filter((p) => p.title)
      });
      setMsg("Perfil guardado correctamente.");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const center = form.lat != null ? [form.lat, form.lng] : DEFAULT_CENTER;

  return (
    <div>
      <h2 className="section-title">Mi perfil profesional</h2>
      {error && <div className="alert error">{error}</div>}
      {msg && <div className="alert ok">{msg}</div>}

      <form onSubmit={save} className="grid cols-2">
        <div className="card">
          <div className="field">
            <label>Oficios (separados por coma)</label>
            <input value={form.oficios} onChange={set("oficios")} placeholder="Plomería, Gasista" />
          </div>
          <div className="field">
            <label>Descripción / experiencia</label>
            <textarea value={form.bio} onChange={set("bio")} />
          </div>
          <div className="grid cols-2" style={{ gap: 12 }}>
            <div className="field">
              <label>Tarifa referencia ($/h)</label>
              <input type="number" value={form.hourlyRate} onChange={set("hourlyRate")} />
            </div>
            <div className="field">
              <label>Cobertura (km)</label>
              <input type="number" value={form.coverageKm} onChange={set("coverageKm")} />
            </div>
          </div>
          <div className="field">
            <label>Barrio / dirección de referencia</label>
            <input value={form.address} onChange={set("address")} />
          </div>
          <div className="field">
            <label>URL de foto de perfil</label>
            <input value={form.photoUrl} onChange={set("photoUrl")} placeholder="https://…" />
          </div>
          <button className="btn" disabled={busy}>{busy ? "Guardando…" : "Guardar perfil"}</button>
        </div>

        <div className="card">
          <h3>Ubicación base</h3>
          <p className="muted" style={{ marginTop: -6 }}>
            Hacé clic en el mapa para fijar tu zona. El círculo muestra tu cobertura de {form.coverageKm} km.
          </p>
          <MapView
            center={center}
            zoom={12}
            onPick={pick}
            me={form.lat != null ? { lat: form.lat, lng: form.lng, label: "Tu ubicación" } : null}
            pickCoverageKm={Number(form.coverageKm) || null}
          />
          {form.lat != null && (
            <p className="muted" style={{ marginTop: 8 }}>
              Coordenadas: {form.lat.toFixed(4)}, {form.lng.toFixed(4)}
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
