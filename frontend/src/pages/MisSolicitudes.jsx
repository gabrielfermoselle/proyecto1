import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../services/api.js";
import SolicitudRow from "../components/SolicitudRow.jsx";
import { SkeletonJobList } from "../components/Skeleton.jsx";
import { ESTADOS_ACTIVOS } from "../utils/catalogos.js";

const VISTAS = [
  { id: "activas", label: "En curso" },
  { id: "historial", label: "Historial" }
];

// Panel del cliente: sus solicitudes, activas e históricas.
export default function MisSolicitudes() {
  const [solicitudes, setSolicitudes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [vista, setVista] = useState("activas");

  useEffect(() => {
    api.get("/solicitudes").then(setSolicitudes).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const lista = useMemo(
    () => solicitudes.filter((s) => ESTADOS_ACTIVOS.includes(s.estado) === (vista === "activas")),
    [solicitudes, vista]
  );

  return (
    <div className="panel-page">
      <div className="spread panel-header">
        <h2 className="section-title" style={{ margin: 0 }}>Mis solicitudes</h2>
        <Link to="/solicitudes/nueva" className="btn gold">Publicar flete</Link>
      </div>

      <div className="modal-tabs" role="tablist" style={{ marginBottom: 16 }}>
        {VISTAS.map((v) => (
          <button
            key={v.id}
            type="button"
            role="tab"
            aria-selected={vista === v.id}
            className={`modal-tab ${vista === v.id ? "active" : ""}`}
            onClick={() => setVista(v.id)}
          >
            {v.label}
          </button>
        ))}
      </div>

      {loading && <SkeletonJobList />}

      {!loading && (
        <div className="card job-list-card">
          {lista.length === 0 && (
            <div className="empty">
              {vista === "activas" ? "Sin fletes en curso." : "Sin historial."}
            </div>
          )}
          {lista.map((s, i) => (
            <SolicitudRow
              key={s.id}
              s={s}
              index={i}
              detalle={
                s.estado === "publicada"
                  ? `${s.cantidadPresupuestos} ${s.cantidadPresupuestos === 1 ? "presupuesto recibido" : "presupuestos recibidos"}`
                  : s.fleteroNombre && `Fletero: ${s.fleteroNombre}`
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}
