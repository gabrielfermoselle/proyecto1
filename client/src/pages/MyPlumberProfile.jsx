import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { api } from "../services/api.js";
import { useAuth } from "../hooks/useAuth.js";
import { StarsDisplay } from "../components/Stars.jsx";
import MapView from "../components/MapView.jsx";
import { EditIcon } from "../components/Icons.jsx";

export default function MyPlumberProfile() {
  const { plumberId } = useAuth();
  const location = useLocation();
  const [p, setP] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!plumberId) return;
    api.get(`/plumbers/${plumberId}`).then(setP).catch((e) => setError(e.message));
  }, [plumberId]);

  if (error) return <div className="alert error">{error}</div>;
  if (!p) return <div>Cargando…</div>;

  return (
    <div>
      <div className="spread panel-header">
        <h2 className="section-title" style={{ margin: 0 }}>Mi perfil</h2>
        <Link
          to="/mi-perfil"
          state={{ background: location }}
          className="btn gold panel-edit-btn"
        >
          <EditIcon /> Editar mi perfil
        </Link>
      </div>

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
            {p.reviews.length === 0 && <div className="empty">Todavía no hay reseñas.</div>}
            {p.reviews.map((r) => (
              <div key={r.id} style={{ padding: "12px 0", borderTop: "1px solid var(--paper-line)" }}>
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
    </div>
  );
}
