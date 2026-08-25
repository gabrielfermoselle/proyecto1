import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api } from "../services/api.js";
import { useAuth } from "../hooks/useAuth.js";
import { StarsDisplay } from "../components/Stars.jsx";
import MapView from "../components/MapView.jsx";
import CreateOrderModal from "../components/CreateOrderModal.jsx";

export default function PlumberProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [p, setP] = useState(null);
  const [error, setError] = useState("");
  const [showHire, setShowHire] = useState(false);

  useEffect(() => {
    api.get(`/plumbers/${id}`).then(setP).catch((e) => setError(e.message));
  }, [id]);

  function onOrderCreated(job) {
    setShowHire(false);
    navigate(`/trabajo/${job.id}`);
  }

  if (error) return <div className="alert error">{error}</div>;
  if (!p) return <div>Cargando…</div>;

  const canHire = !user || user.role === "client";

  return (
    <div className="grid cols-2">
      <div className="grid" style={{ gap: 20 }}>
        <div className="card">
          <div className="top" style={{ display: "flex", gap: 16, alignItems: "center" }}>
            <img className="avatar" style={{ width: 80, height: 80 }} src={p.fotoUrl || `https://i.pravatar.cc/150?u=${p.id}`} alt={p.name} />
            <div>
              <h2 style={{ margin: "0 0 6px" }}>{p.name}</h2>
              <StarsDisplay value={p.avgRating} count={p.reviewCount} />
              <div className="chips" style={{ marginTop: 8 }}>
                {p.especialidad.map((e) => (
                  <span className="chip" key={e}>{e}</span>
                ))}
                <span className={`chip ${p.disponible ? "" : "chip-off"}`}>
                  {p.disponible ? "Disponible" : "No disponible"}
                </span>
              </div>
            </div>
          </div>
          <hr className="sep" />
          <p>{p.descripcion || "Sin descripción."}</p>
          <div className="row">
            <span className="chip">💵 ${p.hourlyRate}/h referencia</span>
            <span className="chip">✅ {p.completedJobs} trabajos completados</span>
            <span className="chip">📍 {p.address || "Zona no especificada"}</span>
            <span className="chip">🛠️ Cubre {p.radioTrabajoKm} km a la redonda</span>
          </div>

          {canHire && (
            <>
              <hr className="sep" />
              <button className="btn" onClick={() => (user ? setShowHire(true) : navigate("/login"))}>
                Solicitar contratación
              </button>
            </>
          )}
        </div>

        {p.portfolio.length > 0 && (
          <div className="card">
            <h3>Portafolio de trabajos</h3>
            <div className="portfolio-grid">
              {p.portfolio.map((item, i) => (
                <div className="portfolio-item" key={i}>
                  {item.imageUrl && <img src={item.imageUrl} alt={item.title} />}
                  <div className="pt">{item.title}</div>
                  <div className="muted">{item.description}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="grid" style={{ gap: 20 }}>
        {p.latitud != null && (
          <div className="card">
            <h3>Zona de cobertura</h3>
            <MapView
              center={[p.latitud, p.longitud]}
              zoom={12}
              me={{ lat: p.latitud, lng: p.longitud, label: p.name }}
              pickCoverageKm={p.radioTrabajoKm}
            />
          </div>
        )}

        <div className="card">
          <h3>Reseñas verificadas ({p.reviewCount})</h3>
          <p className="muted" style={{ marginTop: -6 }}>
            Solo pueden reseñar clientes que completaron una contratación real.
          </p>
          {p.reviews.length === 0 && <div className="empty">Todavía no hay reseñas.</div>}
          {p.reviews.map((r) => (
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

      {showHire && (
        <CreateOrderModal plumber={p} onClose={() => setShowHire(false)} onCreated={onOrderCreated} />
      )}
    </div>
  );
}
