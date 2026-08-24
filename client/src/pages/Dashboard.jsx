import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../services/api.js";
import { useAuth } from "../hooks/useAuth.js";
import { BriefcaseIcon, ClockIcon, CoinIcon } from "../components/Icons.jsx";

const STATUS_LABEL = {
  requested: "Solicitado",
  accepted: "Aceptado",
  completed: "Completado",
  cancelled: "Cancelado"
};

const STATUS_DOT = {
  requested: "var(--warn)",
  accepted: "var(--teal-bright)",
  completed: "var(--success)",
  cancelled: "var(--danger)"
};

export default function Dashboard() {
  const { user } = useAuth();
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/jobs").then(setJobs).finally(() => setLoading(false));
  }, []);

  const isClient = user.role === "client";

  const stats = useMemo(() => {
    const active = jobs.filter((j) => j.status === "requested" || j.status === "accepted").length;
    const completed = jobs.filter((j) => j.status === "completed").length;
    const earned = jobs
      .filter((j) => j.status === "completed" && j.agreedPrice != null)
      .reduce((sum, j) => sum + j.agreedPrice, 0);
    return { active, completed, earned };
  }, [jobs]);

  return (
    <div className="panel-page">
      <div className="spread panel-header">
        <div>
          <h2 className="section-title" style={{ margin: 0 }}>
            {isClient ? "Mis contrataciones" : "Panel del plomero"}
          </h2>
          <p className="muted" style={{ margin: "4px 0 0" }}>
            {isClient
              ? "Seguimiento de tus solicitudes y trabajos en curso."
              : `Bienvenido, ${user.name}. Así está tu actividad hoy.`}
          </p>
        </div>
        <div className="row">
          {isClient && <Link to="/directorio" className="btn ghost">Buscar profesionales</Link>}
        </div>
      </div>

      {!isClient && (
        <div className="stat-strip">
          <div className="stat-plate">
            <span className="stat-icon"><ClockIcon /></span>
            <div>
              <div className="stat-num">{loading ? "–" : stats.active}</div>
              <div className="stat-label">En curso</div>
            </div>
          </div>
          <div className="stat-plate">
            <span className="stat-icon"><BriefcaseIcon /></span>
            <div>
              <div className="stat-num">{loading ? "–" : stats.completed}</div>
              <div className="stat-label">Completados</div>
            </div>
          </div>
          <div className="stat-plate">
            <span className="stat-icon"><CoinIcon /></span>
            <div>
              <div className="stat-num">{loading ? "–" : `$${stats.earned}`}</div>
              <div className="stat-label">Facturado</div>
            </div>
          </div>
        </div>
      )}

      <div className="card job-list-card">
        {loading && <div className="empty">Cargando…</div>}
        {!loading && jobs.length === 0 && (
          <div className="empty">
            {isClient
              ? "Todavía no contrataste a nadie. Buscá un profesional en el directorio."
              : "Todavía no recibiste solicitudes."}
          </div>
        )}
        {jobs.map((j, i) => (
          <div className="job-row job-row-anim" style={{ "--i": i }} key={j.id}>
            <div className="job-row-main">
              <span className="job-dot" style={{ background: STATUS_DOT[j.status] }} />
              <div>
                <div style={{ fontWeight: 700 }}>{j.title}</div>
                <div className="muted">
                  {isClient ? `Plomero: ${j.plumberName}` : `Cliente: ${j.clientName}`}
                  {" · "}
                  {new Date(j.createdAt).toLocaleDateString()}
                </div>
              </div>
            </div>
            <div className="row">
              {j.agreedPrice != null && <span className="tag-price">${j.agreedPrice}</span>}
              <span className={`status ${j.status}`}>{STATUS_LABEL[j.status]}</span>
              <Link to={`/trabajo/${j.id}`} className="btn sm">Abrir</Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
