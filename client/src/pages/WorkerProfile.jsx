import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api } from "../api.js";
import { useAuth } from "../state/AuthContext.jsx";
import { StarsDisplay } from "../components/Stars.jsx";
import MapView from "../components/MapView.jsx";

export default function WorkerProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [w, setW] = useState(null);
  const [error, setError] = useState("");
  const [showHire, setShowHire] = useState(false);
  const [form, setForm] = useState({ title: "", description: "" });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get(`/workers/${id}`).then(setW).catch((e) => setError(e.message));
  }, [id]);

  async function hire(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const job = await api.post("/jobs", { workerId: id, ...form });
      navigate(`/trabajo/${job.id}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (error) return <div className="alert error">{error}</div>;
  if (!w) return <div>Cargando…</div>;

  const canHire = !user || user.role === "client";

  return (
    <div className="grid cols-2">
      <div className="grid" style={{ gap: 20 }}>
        <div className="card">
          <div className="top" style={{ display: "flex", gap: 16, alignItems: "center" }}>
            <img className="avatar" style={{ width: 80, height: 80 }} src={w.photoUrl || `https://i.pravatar.cc/150?u=${w.id}`} alt={w.name} />
            <div>
              <h2 style={{ margin: "0 0 6px" }}>{w.name}</h2>
              <StarsDisplay value={w.avgRating} count={w.reviewCount} />
              <div className="chips" style={{ marginTop: 8 }}>
                {w.oficios.map((o) => (
                  <span className="chip" key={o}>{o}</span>
                ))}
              </div>
            </div>
          </div>
          <hr className="sep" />
          <p>{w.bio || "Sin descripción."}</p>
          <div className="row">
            <span className="chip">💵 ${w.hourlyRate}/h referencia</span>
            <span className="chip">✅ {w.completedJobs} trabajos completados</span>
            <span className="chip">📍 {w.address || "Zona no especificada"}</span>
            <span className="chip">🛠️ Cubre {w.coverageKm} km a la redonda</span>
          </div>

          {canHire && (
            <>
              <hr className="sep" />
              {!showHire ? (
                <button className="btn" onClick={() => (user ? setShowHire(true) : navigate("/login"))}>
                  Solicitar contratación
                </button>
              ) : (
                <form onSubmit={hire}>
                  <div className="field">
                    <label>¿Qué necesitás?</label>
                    <input
                      placeholder="Ej: Arreglo de canilla que pierde"
                      value={form.title}
                      onChange={(e) => setForm({ ...form, title: e.target.value })}
                      required
                    />
                  </div>
                  <div className="field">
                    <label>Detalles</label>
                    <textarea
                      placeholder="Contá el problema, materiales, disponibilidad…"
                      value={form.description}
                      onChange={(e) => setForm({ ...form, description: e.target.value })}
                    />
                  </div>
                  <div className="row">
                    <button className="btn success" disabled={busy}>
                      {busy ? "Enviando…" : "Enviar solicitud"}
                    </button>
                    <button type="button" className="btn ghost" onClick={() => setShowHire(false)}>
                      Cancelar
                    </button>
                  </div>
                  <p className="muted" style={{ marginTop: 8 }}>
                    Se abrirá un chat interno con el profesional para acordar el presupuesto.
                  </p>
                </form>
              )}
            </>
          )}
        </div>

        {w.portfolio.length > 0 && (
          <div className="card">
            <h3>Portafolio de trabajos</h3>
            <div className="portfolio-grid">
              {w.portfolio.map((p, i) => (
                <div className="portfolio-item" key={i}>
                  {p.imageUrl && <img src={p.imageUrl} alt={p.title} />}
                  <div className="pt">{p.title}</div>
                  <div className="muted">{p.description}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="grid" style={{ gap: 20 }}>
        {w.lat != null && (
          <div className="card">
            <h3>Zona de cobertura</h3>
            <MapView
              center={[w.lat, w.lng]}
              zoom={12}
              me={{ lat: w.lat, lng: w.lng, label: w.name }}
              pickCoverageKm={w.coverageKm}
            />
          </div>
        )}

        <div className="card">
          <h3>Reseñas verificadas ({w.reviewCount})</h3>
          <p className="muted" style={{ marginTop: -6 }}>
            Solo pueden reseñar clientes que completaron una contratación real.
          </p>
          {w.reviews.length === 0 && <div className="empty">Todavía no hay reseñas.</div>}
          {w.reviews.map((r) => (
            <div key={r.id} style={{ padding: "12px 0", borderTop: "1px solid var(--border)" }}>
              <div className="spread">
                <strong>{r.clientName}</strong>
                <span className="stars">{"★".repeat(r.rating)}{"☆".repeat(5 - r.rating)}</span>
              </div>
              <div className="muted">{new Date(r.createdAt).toLocaleDateString()}</div>
              <p style={{ margin: "6px 0 0" }}>{r.comment}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
