import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../api.js";
import MapView from "../components/MapView.jsx";
import { StarsDisplay } from "../components/Stars.jsx";

const DEFAULT_CENTER = [-34.9011, -56.1645]; // Montevideo

export default function Directory() {
  const [searchParams] = useSearchParams();
  const [workers, setWorkers] = useState([]);
  const [oficios, setOficios] = useState([]);
  const [oficio, setOficio] = useState(searchParams.get("oficio") || "");
  const [q, setQ] = useState("");
  const [radius, setRadius] = useState("");
  const [sort, setSort] = useState("rating");
  const [me, setMe] = useState(null); // { lat, lng }
  const [loading, setLoading] = useState(false);
  const [geoMsg, setGeoMsg] = useState("");
  const [apiDown, setApiDown] = useState(false);

  useEffect(() => {
    api.get("/workers/oficios").then(setOficios).catch(() => {});
  }, []);

  async function load() {
    setLoading(true);
    const params = new URLSearchParams();
    if (oficio) params.set("oficio", oficio);
    if (q) params.set("q", q);
    if (sort) params.set("sort", sort);
    if (me) {
      params.set("lat", me.lat);
      params.set("lng", me.lng);
      if (radius) params.set("radius", radius);
    }
    try {
      const data = await api.get(`/workers?${params.toString()}`);
      setWorkers(Array.isArray(data) ? data : []);
      setApiDown(false);
    } catch {
      // Sin backend disponible (p. ej. demo estática): mostramos aviso.
      setApiDown(true);
      setWorkers([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [oficio, sort, me, radius]);

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

  const markers = useMemo(
    () =>
      workers
        .filter((w) => w.lat != null && w.lng != null)
        .map((w) => ({
          id: w.id,
          lat: w.lat,
          lng: w.lng,
          name: w.name,
          label: `${w.oficios.join(", ")}${w.distanceKm != null ? ` · ${w.distanceKm} km` : ""}`
        })),
    [workers]
  );

  const center = me ? [me.lat, me.lng] : DEFAULT_CENTER;

  return (
    <div>
      <div className="spread" style={{ margin: "24px 0 4px" }}>
        <h1 className="section-title" style={{ margin: 0 }}>Directorio de oficiales</h1>
      </div>
      <p className="muted" style={{ marginBottom: 20 }}>
        Filtrá por rubro, zona y distancia. Cada reseña está anclada a un trabajo real y completado.
      </p>

      {apiDown && (
        <div className="alert info" style={{ marginBottom: 20 }}>
          Demo visual sin servidor: el backend (directorio, login y chat) no está conectado en este
          entorno. Para la experiencia completa, ejecutá el proyecto localmente con <b>npm run dev</b>.
        </div>
      )}

      <div className="grid dir-layout">
        <div className="card">
          <h3>Filtros</h3>
          <div className="field">
            <label>Buscar</label>
            <input
              placeholder="Nombre, oficio o palabra clave"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && load()}
            />
          </div>
          <div className="field">
            <label>Oficio</label>
            <select value={oficio} onChange={(e) => setOficio(e.target.value)}>
              <option value="">Todos los oficios</option>
              {oficios.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Ordenar por</label>
            <select value={sort} onChange={(e) => setSort(e.target.value)}>
              <option value="rating">Mejor calificados</option>
              <option value="distance">Más cercanos</option>
            </select>
          </div>

          <hr className="sep" />
          <label>Zona de cobertura</label>
          <button className="btn ghost block" onClick={useMyLocation}>
            📍 Usar mi ubicación
          </button>
          {me && (
            <div className="field" style={{ marginTop: 12 }}>
              <label>Distancia máxima: {radius || "sin límite"} {radius ? "km" : ""}</label>
              <input
                type="range"
                min="0"
                max="30"
                step="1"
                value={radius || 0}
                onChange={(e) => setRadius(e.target.value === "0" ? "" : e.target.value)}
              />
            </div>
          )}
          {geoMsg && <div className="muted" style={{ marginTop: 8 }}>{geoMsg}</div>}
          <button className="btn block" style={{ marginTop: 12 }} onClick={load}>
            Aplicar filtros
          </button>
        </div>

        <div className="grid" style={{ gap: 20 }}>
          <MapView center={center} markers={markers} me={me ? { ...me, label: "Tú estás aquí" } : null} />

          <div className="spread">
            <span className="section-title" style={{ margin: 0 }}>
              {loading ? "Buscando…" : `${workers.length} profesionales`}
            </span>
          </div>

          {workers.length === 0 && !loading && (
            <div className="card empty">No hay profesionales que coincidan con tu búsqueda.</div>
          )}

          <div className="worker-list">
            {workers.map((w) => (
              <Link to={`/trabajador/${w.id}`} key={w.id} className="card worker">
                <div className="top">
                  <img className="avatar" src={w.photoUrl || `https://i.pravatar.cc/100?u=${w.id}`} alt={w.name} />
                  <div>
                    <div className="name">{w.name}</div>
                    <StarsDisplay value={w.avgRating} count={w.reviewCount} />
                  </div>
                </div>
                <div className="chips">
                  {w.oficios.map((o) => (
                    <span className="chip" key={o}>{o}</span>
                  ))}
                </div>
                <div className="muted" style={{ minHeight: 34 }}>
                  {w.bio ? w.bio.slice(0, 90) + (w.bio.length > 90 ? "…" : "") : "Sin descripción"}
                </div>
                <div className="meta-row">
                  <span>{w.completedJobs} trabajos hechos</span>
                  {w.distanceKm != null && (
                    <span className={`dist-tag ${w.inCoverage ? "dist-in" : "dist-out"}`}>
                      {w.distanceKm} km {w.inCoverage ? "· en zona" : ""}
                    </span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
