import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../services/api.js";
import MapSearchModal from "../components/MapSearchModal.jsx";
import { StarsDisplay } from "../components/Stars.jsx";
import { MapPinIcon } from "../components/Icons.jsx";
import { SkeletonCard } from "../components/Skeleton.jsx";
import { VEHICULOS, VEHICULO_LABEL, CENTRO_TUCUMAN } from "../utils/catalogos.js";
import { formatPrecio } from "../utils/format.js";

const RADIOS = [5, 10, 20, 50];

export default function Fleteros() {
  const [searchParams] = useSearchParams();
  const [fleteros, setFleteros] = useState([]);
  const [filtros, setFiltros] = useState({
    tipoVehiculo: searchParams.get("tipoVehiculo") || "",
    precioMaximo: "",
    calificacionMinima: "",
    radioKm: "20",
    orden: "distancia"
  });
  const [origen, setOrigen] = useState(null); // { lat, lng }
  const [loading, setLoading] = useState(false);
  const [geoMsg, setGeoMsg] = useState("");
  const [apiDown, setApiDown] = useState(false);
  const [mapModalOpen, setMapModalOpen] = useState(false);

  const set = (k) => (e) => setFiltros((f) => ({ ...f, [k]: e.target.value }));

  async function load() {
    setLoading(true);
    const params = new URLSearchParams();
    if (filtros.tipoVehiculo) params.set("tipoVehiculo", filtros.tipoVehiculo);
    if (filtros.precioMaximo) params.set("precioMaximo", filtros.precioMaximo);
    if (filtros.calificacionMinima) params.set("calificacionMinima", filtros.calificacionMinima);
    params.set("orden", filtros.orden);
    if (origen) {
      params.set("lat", origen.lat);
      params.set("lng", origen.lng);
      if (filtros.radioKm) params.set("radioKm", filtros.radioKm);
    }
    try {
      const data = await api.get(`/fleteros?${params.toString()}`, { silent: true });
      setFleteros(Array.isArray(data) ? data : []);
      setApiDown(false);
    } catch {
      setApiDown(true);
      setFleteros([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtros, origen]);

  function useMyLocation() {
    if (!navigator.geolocation) {
      setGeoMsg("Tu navegador no soporta geolocalización.");
      return;
    }
    setGeoMsg("Obteniendo ubicación…");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setOrigen({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setGeoMsg("");
      },
      () => {
        setOrigen({ lat: CENTRO_TUCUMAN[0], lng: CENTRO_TUCUMAN[1] });
        setGeoMsg("No se pudo obtener tu ubicación.");
      }
    );
  }

  return (
    <div className="panel-page">
      <div className="panel-header">
        <h1 className="section-title" style={{ margin: 0 }}>Fleteros</h1>
      </div>

      {apiDown && (
        <div className="alert error" style={{ marginBottom: 20 }}>No se pudo conectar con el servidor.</div>
      )}

      <div className="dir-map-cta-row">
        <button type="button" className="btn-map-search" onClick={() => setMapModalOpen(true)}>
          <span className="btn-map-search-badge"><MapPinIcon width={16} height={16} /></span>
          Origen en el mapa
        </button>
      </div>

      <div className="spread dir-results-head">
        {!origen ? (
          <button className="link-loc" onClick={useMyLocation}>
            <MapPinIcon width={14} height={14} /> Usar mi ubicación
          </button>
        ) : (
          <span className="row" style={{ gap: 8 }}>
            <span className="dist-tag dist-in">📍 Origen marcado</span>
            <button type="button" className="link-loc" onClick={() => setOrigen(null)}>Quitar</button>
          </span>
        )}
        <span className="muted">
          {loading ? "Buscando…" : `${fleteros.length} ${fleteros.length === 1 ? "fletero" : "fleteros"}`}
        </span>
      </div>
      {geoMsg && <div className="muted" style={{ marginBottom: 8 }}>{geoMsg}</div>}

      <div className="dir-feed-layout">
        <aside className="card dir-sidebar">
          <h3>Vehículo</h3>
          <div className="dir-sidebar-list">
            <button
              type="button"
              className={`chip oficio ${!filtros.tipoVehiculo ? "chip-active" : ""}`}
              onClick={() => setFiltros((f) => ({ ...f, tipoVehiculo: "" }))}
            >
              Todos
            </button>
            {VEHICULOS.map((v) => (
              <button
                key={v.id}
                type="button"
                className={`chip oficio ${filtros.tipoVehiculo === v.id ? "chip-active" : ""}`}
                onClick={() => setFiltros((f) => ({ ...f, tipoVehiculo: v.id }))}
              >
                {v.label}
              </button>
            ))}
          </div>

          <div className="filtros">
            <div className="field">
              <label htmlFor="f-precio">Precio máx. ($)</label>
              <input id="f-precio" type="number" min="0" value={filtros.precioMaximo} onChange={set("precioMaximo")} placeholder="Sin límite" />
            </div>
            <div className="field">
              <label htmlFor="f-calif">Calificación mínima</label>
              <select id="f-calif" value={filtros.calificacionMinima} onChange={set("calificacionMinima")}>
                <option value="">Cualquiera</option>
                <option value="3">3 ★ o más</option>
                <option value="4">4 ★ o más</option>
                <option value="4.5">4.5 ★ o más</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="f-radio">Distancia máxima</label>
              <select id="f-radio" value={filtros.radioKm} onChange={set("radioKm")} disabled={!origen}>
                <option value="">Sin límite</option>
                {RADIOS.map((r) => (
                  <option key={r} value={r}>{r} km</option>
                ))}
              </select>
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label htmlFor="f-orden">Ordenar por</label>
              <select id="f-orden" value={filtros.orden} onChange={set("orden")}>
                <option value="distancia">Cercanía</option>
                <option value="calificacion">Calificación</option>
                <option value="precio">Precio</option>
              </select>
            </div>
          </div>
        </aside>

        <div className="dir-content">
          {loading && (
            <div className="dir-profile-list" aria-busy="true" aria-label="Cargando fleteros">
              {Array.from({ length: 4 }).map((_, i) => (
                <SkeletonCard key={i} />
              ))}
            </div>
          )}

          {fleteros.length === 0 && !loading && (
            <div className="card empty">Sin resultados.</div>
          )}

          <div className="dir-profile-list">
            {!loading &&
              fleteros.map((f) => (
                <Link to={`/fletero/${f.id}`} key={f.id} className="card worker-profile">
                  <img className="avatar avatar-lg" src={f.fotoUrl || `https://i.pravatar.cc/160?u=${f.id}`} alt={f.nombre} />
                  <div className="worker-profile-body">
                    <div className="spread" style={{ alignItems: "flex-start" }}>
                      <div>
                        <div className="name">{f.nombre}</div>
                        <StarsDisplay value={f.promedioCalificacion} count={f.cantidadResenas} />
                      </div>
                      {f.distanciaKm != null && (
                        <span className={`dist-tag ${f.enZona ? "dist-in" : "dist-out"}`}>
                          {f.distanciaKm} km {f.enZona ? "· en zona" : ""}
                        </span>
                      )}
                    </div>
                    <div className="chips" style={{ margin: "8px 0" }}>
                      <span className="chip">{VEHICULO_LABEL[f.tipoVehiculo]}</span>
                      {f.capacidadKg ? <span className="chip">Hasta {f.capacidadKg} kg</span> : null}
                      {!f.disponible && <span className="chip chip-off">No disponible</span>}
                    </div>
                    <div className="muted">
                      {f.descripcion ? f.descripcion.slice(0, 140) + (f.descripcion.length > 140 ? "…" : "") : ""}
                    </div>
                    <div className="meta-row" style={{ marginTop: 10 }}>
                      <span>{f.fletesCompletados} fletes completados</span>
                      {f.tarifaBase > 0 && <span className="tag-price">Desde {formatPrecio(f.tarifaBase)}</span>}
                    </div>
                  </div>
                </Link>
              ))}
          </div>
        </div>
      </div>

      {mapModalOpen && (
        <MapSearchModal
          initialCenter={origen ? [origen.lat, origen.lng] : null}
          title="Origen"
          confirmLabel="Buscar"
          onClose={() => setMapModalOpen(false)}
          onConfirm={(lat, lng) => {
            setOrigen({ lat, lng });
            setGeoMsg("");
          }}
        />
      )}
    </div>
  );
}
