import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../services/api.js";
import { useAuth } from "../hooks/useAuth.js";
import SolicitudRow from "../components/SolicitudRow.jsx";
import { BriefcaseIcon, ClockIcon, CoinIcon } from "../components/Icons.jsx";
import { SkeletonJobList } from "../components/Skeleton.jsx";
import { formatPrecio } from "../utils/format.js";

const GRUPOS = [
  { id: "asignados", label: "Asignados" },
  { id: "cotizados", label: "Presupuestos enviados" },
  { id: "historial", label: "Historial" }
];

// Panel del fletero: fletes aceptados, presupuestos pendientes e historial.
export default function MisFletes() {
  const { fleteroId } = useAuth();
  const [solicitudes, setSolicitudes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [vista, setVista] = useState("asignados");

  useEffect(() => {
    api.get("/solicitudes").then(setSolicitudes).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const grupos = useMemo(() => {
    const mia = (s) => s.fleteroId === fleteroId;
    return {
      asignados: solicitudes.filter((s) => mia(s) && ["confirmada", "en_transito", "entregada"].includes(s.estado)),
      cotizados: solicitudes.filter((s) => s.estado === "publicada"),
      historial: solicitudes.filter(
        (s) => ["completada", "cancelada"].includes(s.estado) || (s.fleteroId && !mia(s))
      )
    };
  }, [solicitudes, fleteroId]);

  const stats = useMemo(() => {
    const completados = solicitudes.filter((s) => s.fleteroId === fleteroId && s.estado === "completada");
    return {
      activos: grupos.asignados.length,
      completados: completados.length,
      facturado: completados.reduce((sum, s) => sum + (s.precioAcordado || 0), 0)
    };
  }, [solicitudes, grupos, fleteroId]);

  function detalle(s) {
    if (s.fleteroId && s.fleteroId !== fleteroId) return "El cliente eligió otro presupuesto";
    if (s.estado === "publicada" && s.miPresupuesto) {
      return `Tu presupuesto: ${formatPrecio(s.miPresupuesto.monto)} · Cliente: ${s.clienteNombre}`;
    }
    return `Cliente: ${s.clienteNombre}`;
  }

  const lista = grupos[vista];

  return (
    <div className="panel-page">
      <div className="spread panel-header">
        <h2 className="section-title" style={{ margin: 0 }}>Mis fletes</h2>
        <Link to="/disponibles" className="btn gold">Solicitudes cerca</Link>
      </div>

      <div className="stat-strip">
        <div className="stat-plate">
          <span className="stat-icon"><ClockIcon /></span>
          <div>
            <div className="stat-num">{loading ? "–" : stats.activos}</div>
            <div className="stat-label">En curso</div>
          </div>
        </div>
        <div className="stat-plate">
          <span className="stat-icon"><BriefcaseIcon /></span>
          <div>
            <div className="stat-num">{loading ? "–" : stats.completados}</div>
            <div className="stat-label">Completados</div>
          </div>
        </div>
        <div className="stat-plate">
          <span className="stat-icon"><CoinIcon /></span>
          <div>
            <div className="stat-num">{loading ? "–" : formatPrecio(stats.facturado)}</div>
            <div className="stat-label">Facturado</div>
          </div>
        </div>
      </div>

      <div className="modal-tabs" role="tablist" style={{ marginBottom: 16 }}>
        {GRUPOS.map((g) => (
          <button
            key={g.id}
            type="button"
            role="tab"
            aria-selected={vista === g.id}
            className={`modal-tab ${vista === g.id ? "active" : ""}`}
            onClick={() => setVista(g.id)}
          >
            {g.label} {!loading && `(${grupos[g.id].length})`}
          </button>
        ))}
      </div>

      {loading && <SkeletonJobList rows={3} />}

      {!loading && (
        <div className="card job-list-card">
          {lista.length === 0 && <div className="empty">Sin fletes.</div>}
          {lista.map((s, i) => (
            <SolicitudRow key={s.id} s={s} index={i} detalle={detalle(s)} />
          ))}
        </div>
      )}
    </div>
  );
}
