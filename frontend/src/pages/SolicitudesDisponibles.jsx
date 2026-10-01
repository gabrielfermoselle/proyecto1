import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../services/api.js";
import { useAuth } from "../hooks/useAuth.js";
import MapView from "../components/MapView.jsx";
import { SkeletonCard } from "../components/Skeleton.jsx";
import { CARGA_LABEL, VEHICULO_LABEL } from "../utils/catalogos.js";
import { formatFecha, formatPrecio } from "../utils/format.js";

const RADIOS = [5, 10, 20, 50];

// Fletero: solicitudes publicadas cerca de su zona de trabajo, para enviar presupuesto.
export default function SolicitudesDisponibles() {
  const { fleteroId } = useAuth();
  const [perfil, setPerfil] = useState(null);
  const [data, setData] = useState({ solicitudes: [], referencia: null });
  const [radioKm, setRadioKm] = useState("");
  const [soloMiVehiculo, setSoloMiVehiculo] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!fleteroId) return;
    api.get(`/fleteros/${fleteroId}`, { silent: true }).then((f) => {
      setPerfil(f);
      setRadioKm(String(f.radioTrabajoKm || ""));
    }).catch(() => {});
  }, [fleteroId]);

  useEffect(() => {
    if (!perfil) return;
    const params = new URLSearchParams();
    if (radioKm) params.set("radioKm", radioKm);
    if (soloMiVehiculo) params.set("tipoVehiculo", perfil.tipoVehiculo);
    setLoading(true);
    api
      .get(`/solicitudes/disponibles?${params.toString()}`)
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [perfil, radioKm, soloMiVehiculo]);

  const ref = data.referencia;
  const radios = [...new Set([...RADIOS, Number(perfil?.radioTrabajoKm) || 0])].filter(Boolean).sort((a, b) => a - b);

  return (
    <div className="panel-page">
      <div className="panel-header">
        <h1 className="section-title" style={{ margin: 0 }}>Solicitudes cerca</h1>
      </div>

      {perfil && perfil.latitud == null && (
        <div className="alert info" style={{ marginBottom: 16 }}>
          Falta marcar tu ubicación en <Link className="link" to="/mi-perfil-fletero">tu perfil</Link>.
        </div>
      )}

      <div className="card filtros-inline" style={{ marginBottom: 16 }}>
        <div className="field" style={{ marginBottom: 0 }}>
          <label htmlFor="d-radio">Distancia al origen</label>
          <select id="d-radio" value={radioKm} onChange={(e) => setRadioKm(e.target.value)} disabled={!ref}>
            <option value="">Sin límite</option>
            {radios.map((r) => (
              <option key={r} value={r}>{r} km{r === Number(perfil?.radioTrabajoKm) ? " (mi zona)" : ""}</option>
            ))}
          </select>
        </div>
        <label className="check-inline">
          <input type="checkbox" checked={soloMiVehiculo} onChange={(e) => setSoloMiVehiculo(e.target.checked)} />
          Solo {perfil ? VEHICULO_LABEL[perfil.tipoVehiculo].toLowerCase() : "mi vehículo"}
        </label>
        <span className="muted">
          {loading ? "Buscando…" : `${data.solicitudes.length} ${data.solicitudes.length === 1 ? "solicitud" : "solicitudes"}`}
        </span>
      </div>

      <div className="grid cols-2">
        <div className="dir-profile-list">
          {loading && Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} />)}
          {!loading && data.solicitudes.length === 0 && (
            <div className="card empty">Sin solicitudes.</div>
          )}
          {!loading &&
            data.solicitudes.map((s) => (
              <Link to={`/solicitud/${s.id}`} key={s.id} className="card solicitud-card">
                <div className="spread" style={{ alignItems: "flex-start" }}>
                  <div>
                    <div className="name">{s.titulo}</div>
                    <div className="muted">
                      {CARGA_LABEL[s.tipoCarga]} · {formatFecha(s.fecha)} · {s.cantidadItems} objetos
                    </div>
                  </div>
                  {s.distanciaKm != null && <span className="dist-tag dist-in">{s.distanciaKm} km</span>}
                </div>
                <div className="muted ruta-mini" style={{ marginTop: 6 }}>
                  {s.origenDireccion || "Origen"} → {s.destinoDireccion || "Destino"}
                  {s.distanciaRecorridoKm != null ? ` (${s.distanciaRecorridoKm} km de recorrido)` : ""}
                </div>
                <div className="chips" style={{ marginTop: 8 }}>
                  {s.tipoVehiculo && <span className="chip">{VEHICULO_LABEL[s.tipoVehiculo]}</span>}
                  <span className="chip">{s.cantidadPresupuestos} presupuestos</span>
                  {s.miPresupuesto && (
                    <span className="chip chip-ok">Cotizaste {formatPrecio(s.miPresupuesto.monto)}</span>
                  )}
                </div>
              </Link>
            ))}
        </div>

        <div className="card" style={{ alignSelf: "start" }}>
          <h3>Mapa</h3>
          {ref ? (
            <MapView
              key={`${ref.lat},${ref.lng}`}
              center={[ref.lat, ref.lng]}
              zoom={11}
              tall
              me={{ lat: ref.lat, lng: ref.lng, label: "Tu ubicación" }}
              pickCoverageKm={ref.radioKm || null}
              markers={data.solicitudes.map((s) => ({
                id: s.id,
                lat: s.origenLat,
                lng: s.origenLng,
                name: s.titulo,
                label: s.origenDireccion
              }))}
            />
          ) : (
            <div className="empty">Sin ubicación.</div>
          )}
        </div>
      </div>
    </div>
  );
}
