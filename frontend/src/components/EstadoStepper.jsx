import { ETAPAS } from "../utils/catalogos.js";
import { formatFecha } from "../utils/format.js";

// Seguimiento del flete por etapas, con la fecha en que se alcanzó cada una.
export default function EstadoStepper({ estado, historial = [] }) {
  if (estado === "cancelada") {
    const cancelada = historial.find((h) => h.estado === "cancelada");
    return (
      <div className="alert error" style={{ margin: 0 }}>
        Flete cancelado{cancelada ? ` el ${formatFecha(cancelada.fecha, { hora: true })}` : ""}.
      </div>
    );
  }
  const actual = ETAPAS.findIndex((e) => e.id === estado);
  return (
    <ol className="stepper">
      {ETAPAS.map((etapa, i) => {
        const registro = [...historial].reverse().find((h) => h.estado === etapa.id);
        const cls = i < actual ? "done" : i === actual ? "current" : "";
        return (
          <li key={etapa.id} className={`stepper-item ${cls}`}>
            <span className="stepper-dot">{i < actual || estado === "completada" ? "✓" : i + 1}</span>
            <div>
              <div className="stepper-label">{etapa.label}</div>
              {registro && <div className="muted">{formatFecha(registro.fecha, { hora: true })}</div>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
