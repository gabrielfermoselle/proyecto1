import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../services/api.js";
import { ORDER_STATUS_LABEL, ORDER_STATUS_DOT } from "../utils/orderStatus.js";
import { SkeletonJobList } from "../components/Skeleton.jsx";

export default function MyOrders() {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/jobs").then(setJobs).catch(() => {}).finally(() => setLoading(false));
  }, []);

  return (
    <div className="panel-page">
      <div className="spread panel-header">
        <div>
          <h2 className="section-title" style={{ margin: 0 }}>Mis pedidos</h2>
          <p className="muted" style={{ margin: "4px 0 0" }}>
            Seguimiento de tus solicitudes y trabajos en curso.
          </p>
        </div>
        <div className="row">
          <Link to="/directorio" className="btn ghost">Buscar profesionales</Link>
        </div>
      </div>

      {loading && <SkeletonJobList />}

      {!loading && (
      <div className="card job-list-card">
        {jobs.length === 0 && (
          <div className="empty">
            Todavía no contrataste a nadie. Buscá un profesional en el directorio.
          </div>
        )}
        {jobs.map((j, i) => (
          <div className="job-row job-row-anim" style={{ "--i": i }} key={j.id}>
            <div className="job-row-main">
              <span className="job-dot" style={{ background: ORDER_STATUS_DOT[j.status] }} />
              <div>
                <div style={{ fontWeight: 700 }}>{j.title}</div>
                <div className="muted">
                  Plomero: {j.plumberName} · {new Date(j.createdAt).toLocaleDateString()}
                </div>
              </div>
            </div>
            <div className="row">
              {j.agreedPrice != null && <span className="tag-price">${j.agreedPrice}</span>}
              <span className={`status ${j.status}`}>{ORDER_STATUS_LABEL[j.status]}</span>
              <Link to={`/trabajo/${j.id}`} className="btn sm">Abrir</Link>
            </div>
          </div>
        ))}
      </div>
      )}
    </div>
  );
}
