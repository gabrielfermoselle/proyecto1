import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../services/api.js";
import { useAuth } from "../hooks/useAuth.js";
import { BriefcaseIcon, ClockIcon, CoinIcon } from "../components/Icons.jsx";
import { ORDER_STATUS_LABEL, ORDER_STATUS_DOT } from "../utils/orderStatus.js";
import { SkeletonJobList } from "../components/Skeleton.jsx";

// Próximas acciones disponibles para el plomero según el estado actual del pedido.
const NEXT_ACTIONS = {
  requested: [
    { status: "accepted", label: "Aceptar", cls: "btn success sm" },
    { status: "cancelled", label: "Rechazar", cls: "btn danger sm" }
  ],
  accepted: [
    { status: "started", label: "Iniciar", cls: "btn sm" },
    { status: "cancelled", label: "Cancelar", cls: "btn ghost sm" }
  ],
  started: [
    { status: "completed", label: "Finalizar", cls: "btn success sm" },
    { status: "cancelled", label: "Cancelar", cls: "btn ghost sm" }
  ],
  completed: [],
  cancelled: []
};

export default function ReceivedOrders() {
  const { user } = useAuth();
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);

  useEffect(() => {
    api.get("/jobs").then(setJobs).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const stats = useMemo(() => {
    const active = jobs.filter((j) => ["requested", "accepted", "started"].includes(j.status)).length;
    const completed = jobs.filter((j) => j.status === "completed").length;
    const earned = jobs
      .filter((j) => j.status === "completed" && j.agreedPrice != null)
      .reduce((sum, j) => sum + j.agreedPrice, 0);
    return { active, completed, earned };
  }, [jobs]);

  async function changeStatus(job, status) {
    setBusyId(job.id);
    try {
      const updated = await api.patch(`/jobs/${job.id}/status`, { status });
      setJobs((prev) => prev.map((j) => (j.id === updated.id ? updated : j)));
    } catch {
      // El toast global ya avisó del error.
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="panel-page">
      <div className="spread panel-header">
        <div>
          <h2 className="section-title" style={{ margin: 0 }}>Pedidos recibidos</h2>
          <p className="muted" style={{ margin: "4px 0 0" }}>
            Bienvenido, {user.name}. Así está tu actividad hoy.
          </p>
        </div>
      </div>

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

      {loading && <SkeletonJobList rows={3} />}

      {!loading && (
      <div className="card job-list-card">
        {jobs.length === 0 && <div className="empty">Todavía no recibiste pedidos.</div>}
        {jobs.map((j, i) => (
          <div className="job-row job-row-anim" style={{ "--i": i }} key={j.id}>
            <div className="job-row-main">
              <span className="job-dot" style={{ background: ORDER_STATUS_DOT[j.status] }} />
              <div>
                <div style={{ fontWeight: 700 }}>{j.title}</div>
                <div className="muted">
                  Cliente: {j.clientName} · {new Date(j.createdAt).toLocaleDateString()}
                </div>
              </div>
            </div>
            <div className="row" style={{ justifyContent: "flex-end" }}>
              {j.agreedPrice != null && <span className="tag-price">${j.agreedPrice}</span>}
              <span className={`status ${j.status}`}>{ORDER_STATUS_LABEL[j.status]}</span>
              {NEXT_ACTIONS[j.status].map((action) => (
                <button
                  key={action.status}
                  type="button"
                  className={action.cls}
                  disabled={busyId === j.id}
                  onClick={() => changeStatus(j, action.status)}
                >
                  {action.label}
                </button>
              ))}
              <Link to={`/trabajo/${j.id}`} className="btn ghost sm">Ver</Link>
            </div>
          </div>
        ))}
      </div>
      )}
    </div>
  );
}
