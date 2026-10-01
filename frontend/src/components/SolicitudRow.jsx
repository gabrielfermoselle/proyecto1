import { Link } from "react-router-dom";
import { ESTADO_LABEL, ESTADO_DOT, CARGA_LABEL, VEHICULO_LABEL } from "../utils/catalogos.js";
import { formatFecha, formatPrecio } from "../utils/format.js";

// Fila de listado de una solicitud de flete (paneles de cliente y fletero).
export default function SolicitudRow({ s, index = 0, detalle, children }) {
  return (
    <div className="job-row job-row-anim" style={{ "--i": index }}>
      <div className="job-row-main">
        <span className="job-dot" style={{ background: ESTADO_DOT[s.estado] }} />
        <div>
          <div style={{ fontWeight: 700 }}>{s.titulo}</div>
          <div className="muted">
            {CARGA_LABEL[s.tipoCarga]}
            {s.tipoVehiculo ? ` · ${VEHICULO_LABEL[s.tipoVehiculo]}` : ""} · {formatFecha(s.fecha)}
          </div>
          <div className="muted ruta-mini">
            {s.origenDireccion || "Origen"} → {s.destinoDireccion || "Destino"}
            {s.distanciaRecorridoKm != null ? ` (${s.distanciaRecorridoKm} km)` : ""}
          </div>
          {detalle && <div className="muted">{detalle}</div>}
        </div>
      </div>
      <div className="row" style={{ justifyContent: "flex-end" }}>
        {s.precioAcordado != null && <span className="tag-price">{formatPrecio(s.precioAcordado)}</span>}
        <span className={`status ${s.estado}`}>{ESTADO_LABEL[s.estado]}</span>
        {children}
        <Link to={`/solicitud/${s.id}`} className="btn sm">Abrir</Link>
      </div>
    </div>
  );
}
