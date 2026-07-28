import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api.js";
import { useAuth } from "../state/AuthContext.jsx";

const STATUS_LABEL = {
  requested: "Solicitado",
  accepted: "Aceptado",
  completed: "Completado",
  cancelled: "Cancelado"
};

export default function Dashboard() {
  const { user } = useAuth();
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/jobs").then(setJobs).finally(() => setLoading(false));
  }, []);

  const isClient = user.role === "client";

  return (
    <div>
      <div className="spread">
        <h2 className="section-title">Mis contrataciones</h2>
        {isClient && <Link to="/" className="btn ghost">Buscar profesionales</Link>}
      </div>

      <div className="card">
        {loading && <div className="empty">Cargando…</div>}
        {!loading && jobs.length === 0 && (
          <div className="empty">
            {isClient
              ? "Todavía no contrataste a nadie. Buscá un profesional en el directorio."
              : "Todavía no recibiste solicitudes."}
          </div>
        )}
        {jobs.map((j) => (
          <div className="job-row" key={j.id}>
            <div>
              <div style={{ fontWeight: 700 }}>{j.title}</div>
              <div className="muted">
                {isClient ? `Trabajador: ${j.workerName}` : `Cliente: ${j.clientName}`}
                {" · "}
                {new Date(j.createdAt).toLocaleDateString()}
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
