import { StarsDisplay } from "./Stars.jsx";
import MapView from "./MapView.jsx";
import { VEHICULO_LABEL } from "../utils/catalogos.js";
import { formatFecha, formatPrecio } from "../utils/format.js";

// Perfil de un fletero: datos, vehículo, zona de trabajo y calificaciones verificadas.
// Lo usan el perfil público y "Mi perfil" (que agrega sus propias acciones en `actions`).
export default function FleteroPerfilView({ fletero: f, actions = null }) {
  return (
    <div className="grid cols-2">
      <div className="grid" style={{ gap: 20 }}>
        <div className="card">
          <div className="top" style={{ display: "flex", gap: 16, alignItems: "center" }}>
            <img className="avatar" style={{ width: 80, height: 80 }} src={f.fotoUrl || `https://i.pravatar.cc/150?u=${f.id}`} alt={f.nombre} />
            <div>
              <h2 style={{ margin: "0 0 6px" }}>{f.nombre}</h2>
              <StarsDisplay value={f.promedioCalificacion} count={f.cantidadResenas} />
              <div className="chips" style={{ marginTop: 8 }}>
                <span className="chip">{VEHICULO_LABEL[f.tipoVehiculo]}</span>
                <span className={`chip ${f.disponible ? "" : "chip-off"}`}>
                  {f.disponible ? "Disponible" : "No disponible"}
                </span>
              </div>
            </div>
          </div>
          <hr className="sep" />
          {f.descripcion && <p>{f.descripcion}</p>}
          <div className="row">
            <span className="chip">💵 Desde {formatPrecio(f.tarifaBase)}</span>
            <span className="chip">✅ {f.fletesCompletados} fletes completados</span>
            <span className="chip">📍 {f.direccion || "Zona no especificada"}</span>
            <span className="chip">🧭 Radio {f.radioTrabajoKm} km</span>
          </div>
          {actions && (
            <>
              <hr className="sep" />
              {actions}
            </>
          )}
        </div>

        <div className="card">
          <h3>Vehículo</h3>
          <div className="vehiculo-ficha">
            {f.fotoVehiculoUrl && <img src={f.fotoVehiculoUrl} alt={`Vehículo de ${f.nombre}`} />}
            <div>
              <div style={{ fontWeight: 700 }}>{VEHICULO_LABEL[f.tipoVehiculo]}</div>
              {f.vehiculoDescripcion && <div className="muted">{f.vehiculoDescripcion}</div>}
              {f.capacidadKg ? <div className="muted">Capacidad aprox.: {f.capacidadKg} kg</div> : null}
            </div>
          </div>
        </div>
      </div>

      <div className="grid" style={{ gap: 20 }}>
        {f.latitud != null && (
          <div className="card">
            <h3>Zona de trabajo</h3>
            <MapView
              center={[f.latitud, f.longitud]}
              zoom={11}
              me={{ lat: f.latitud, lng: f.longitud, label: f.nombre }}
              pickCoverageKm={f.radioTrabajoKm}
            />
          </div>
        )}

        <div className="card">
          <h3>Calificaciones ({f.cantidadResenas})</h3>
          {f.resenas.length === 0 && <div className="empty">Sin calificaciones.</div>}
          {f.resenas.map((r) => (
            <div key={r.id} style={{ padding: "12px 0", borderTop: "1px solid var(--paper-line)" }}>
              <div className="spread">
                <strong>{r.clienteNombre}</strong>
                <span className="stars">{"★".repeat(r.calificacion)}{"☆".repeat(5 - r.calificacion)}</span>
              </div>
              <div className="muted">{formatFecha(r.creadoEn)}</div>
              {r.comentario && <p style={{ margin: "6px 0 0" }}>{r.comentario}</p>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
