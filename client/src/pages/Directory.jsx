import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../services/api.js";
import MapSearchModal from "../components/MapSearchModal.jsx";
import Modal from "../components/Modal.jsx";
import { StarsDisplay } from "../components/Stars.jsx";
import { MapPinIcon } from "../components/Icons.jsx";

const DEFAULT_CENTER = [-34.9011, -56.1645]; // Montevideo

export default function Directory() {
  const [searchParams] = useSearchParams();
  const [plumbers, setPlumbers] = useState([]);
  const [especialidades, setEspecialidades] = useState([]);
  const [especialidad, setEspecialidad] = useState(searchParams.get("especialidad") || "");
  const [me, setMe] = useState(null); // { lat, lng }
  const [loading, setLoading] = useState(false);
  const [geoMsg, setGeoMsg] = useState("");
  const [apiDown, setApiDown] = useState(false);
  const [mapModalOpen, setMapModalOpen] = useState(false);
  const [otrosModalOpen, setOtrosModalOpen] = useState(false);

  const MAIN_OFICIOS_LIMIT = 6;
  const mainOficios = especialidades.slice(0, MAIN_OFICIOS_LIMIT);
  const otrosOficios = especialidades.slice(MAIN_OFICIOS_LIMIT);
  const isOtroActive = especialidad !== "" && otrosOficios.includes(especialidad);

  useEffect(() => {
    api.get("/plumbers/especialidades").then(setEspecialidades).catch(() => {});
  }, []);

  async function load() {
    setLoading(true);
    const params = new URLSearchParams();
    if (especialidad) params.set("especialidad", especialidad);
    // Con ubicación conocida priorizamos a los más cercanos primero.
    params.set("sort", me ? "distance" : "rating");
    if (me) {
      params.set("lat", me.lat);
      params.set("lng", me.lng);
    }
    try {
      const data = await api.get(`/plumbers/search?${params.toString()}`);
      setPlumbers(Array.isArray(data) ? data : []);
      setApiDown(false);
    } catch {
      // Sin backend disponible (p. ej. demo estática): mostramos aviso.
      setApiDown(true);
      setPlumbers([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [especialidad, me]);

  function useMyLocation() {
    setGeoMsg("Obteniendo ubicación…");
    if (!navigator.geolocation) {
      setGeoMsg("Tu navegador no soporta geolocalización.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setMe({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setGeoMsg("");
      },
      () => {
        // Fallback a Montevideo si el usuario deniega el permiso.
        setMe({ lat: DEFAULT_CENTER[0], lng: DEFAULT_CENTER[1] });
        setGeoMsg("No se pudo obtener tu ubicación. Usando Montevideo como referencia.");
      }
    );
  }

  function onMapConfirm(lat, lng) {
    setMe({ lat, lng });
    setGeoMsg("");
    setMapModalOpen(false);
  }

  return (
    <div className="panel-page">
      <div className="panel-header">
        <h1 className="section-title" style={{ margin: 0 }}>Directorio de plomeros</h1>
        <p className="muted" style={{ margin: "4px 0 0" }}>
          Filtrá por especialidad, zona y distancia. Cada reseña está anclada a un trabajo real y completado.
        </p>
      </div>

      {apiDown && (
        <div className="alert info" style={{ marginBottom: 20 }}>
          Demo visual sin servidor: el backend (directorio, login y chat) no está conectado en este
          entorno. Para la experiencia completa, ejecutá el proyecto localmente con <b>npm run dev</b>.
        </div>
      )}

      <div className="dir-map-cta-row">
        <button type="button" className="btn-map-search" onClick={() => setMapModalOpen(true)}>
          <span className="btn-map-search-badge"><MapPinIcon width={16} height={16} /></span>
          Buscar por el mapa
        </button>
      </div>

      <div className="spread dir-results-head">
        {!me ? (
          <button className="link-loc" onClick={useMyLocation}>
            <MapPinIcon width={14} height={14} /> Usar mi ubicación para ver a los más cercanos primero
          </button>
        ) : (
          <span className="dist-tag dist-in">📍 Mostrando primero a los más cercanos</span>
        )}
        <span className="muted">
          {loading ? "Buscando…" : `${plumbers.length} ${plumbers.length === 1 ? "profesional" : "profesionales"}`}
        </span>
      </div>
      {geoMsg && <div className="muted" style={{ marginBottom: 8 }}>{geoMsg}</div>}

      <div className="dir-feed-layout">
        <aside className="card dir-sidebar">
          <h3>Oficios</h3>
          <div className="dir-sidebar-list">
            <button
              type="button"
              className={`chip oficio ${!especialidad ? "chip-active" : ""}`}
              onClick={() => setEspecialidad("")}
            >
              Todas
            </button>
            {mainOficios.map((e) => (
              <button
                key={e}
                type="button"
                className={`chip oficio ${especialidad === e ? "chip-active" : ""}`}
                onClick={() => setEspecialidad(e)}
              >
                {e}
              </button>
            ))}
            {otrosOficios.length > 0 && (
              <button
                type="button"
                className={`chip oficio ${isOtroActive ? "chip-active" : ""}`}
                onClick={() => setOtrosModalOpen(true)}
              >
                Otros
              </button>
            )}
          </div>
        </aside>

        <div className="dir-content">

          {plumbers.length === 0 && !loading && (
            <div className="card empty">No hay profesionales que coincidan con tu búsqueda.</div>
          )}

          <div className="dir-profile-list">
            {plumbers.map((p) => (
              <Link to={`/plomero/${p.id}`} key={p.id} className="card worker-profile">
                <img className="avatar avatar-lg" src={p.fotoUrl || `https://i.pravatar.cc/160?u=${p.id}`} alt={p.name} />
                <div className="worker-profile-body">
                  <div className="spread" style={{ alignItems: "flex-start" }}>
                    <div>
                      <div className="name">{p.name}</div>
                      <StarsDisplay value={p.avgRating} count={p.reviewCount} />
                    </div>
                    {p.distanceKm != null && (
                      <span className={`dist-tag ${p.inCoverage ? "dist-in" : "dist-out"}`}>
                        {p.distanceKm} km {p.inCoverage ? "· en zona" : ""}
                      </span>
                    )}
                  </div>
                  <div className="chips" style={{ margin: "8px 0" }}>
                    {p.especialidad.map((e) => (
                      <span className="chip" key={e}>{e}</span>
                    ))}
                    {!p.disponible && <span className="chip chip-off">No disponible</span>}
                  </div>
                  <div className="muted">
                    {p.descripcion ? p.descripcion.slice(0, 140) + (p.descripcion.length > 140 ? "…" : "") : "Sin descripción"}
                  </div>
                  <div className="meta-row" style={{ marginTop: 10 }}>
                    <span>{p.completedJobs} trabajos hechos</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>

      {mapModalOpen && (
        <MapSearchModal
          initialCenter={me ? [me.lat, me.lng] : null}
          onClose={() => setMapModalOpen(false)}
          onConfirm={onMapConfirm}
        />
      )}

      {otrosModalOpen && (
        <Modal onClose={() => setOtrosModalOpen(false)} eyebrow="Oficios" title="Todos los oficios">
          <div className="dir-otros-modal-list">
            <button
              type="button"
              className={`dir-otros-modal-item ${!especialidad ? "active" : ""}`}
              onClick={() => { setEspecialidad(""); setOtrosModalOpen(false); }}
            >
              Todas las especialidades
            </button>
            {especialidades.map((e) => (
              <button
                key={e}
                type="button"
                className={`dir-otros-modal-item ${especialidad === e ? "active" : ""}`}
                onClick={() => { setEspecialidad(e); setOtrosModalOpen(false); }}
              >
                {e}
              </button>
            ))}
          </div>
        </Modal>
      )}
    </div>
  );
}
