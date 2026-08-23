import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../services/api.js";
import MapView from "../components/MapView.jsx";
import { StarsDisplay } from "../components/Stars.jsx";

const DEFAULT_CENTER = [-34.9011, -56.1645]; // Montevideo

export default function Directory() {
  const [searchParams] = useSearchParams();
  const [plumbers, setPlumbers] = useState([]);
  const [especialidades, setEspecialidades] = useState([]);
  const [especialidad, setEspecialidad] = useState(searchParams.get("especialidad") || "");
  const [q, setQ] = useState("");
  const [radius, setRadius] = useState("");
  const [sort, setSort] = useState("rating");
  const [me, setMe] = useState(null); // { lat, lng }
  const [loading, setLoading] = useState(false);
  const [geoMsg, setGeoMsg] = useState("");
  const [apiDown, setApiDown] = useState(false);

  useEffect(() => {
    api.get("/plumbers/especialidades").then(setEspecialidades).catch(() => {});
  }, []);

  async function load() {
    setLoading(true);
    const params = new URLSearchParams();
    if (especialidad) params.set("especialidad", especialidad);
    if (q) params.set("q", q);
    if (sort) params.set("sort", sort);
    if (me) {
      params.set("lat", me.lat);
      params.set("lng", me.lng);
      if (radius) params.set("radius", radius);
    }
    try {
      const data = await api.get(`/plumbers?${params.toString()}`);
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
  }, [especialidad, sort, me, radius]);

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
      plumbers
        .filter((p) => p.latitud != null && p.longitud != null)
        .map((p) => ({
          id: p.id,
          lat: p.latitud,
          lng: p.longitud,
          name: p.name,
          label: `${p.especialidad.join(", ")}${p.distanceKm != null ? ` · ${p.distanceKm} km` : ""}`
        })),
    [plumbers]
  );

  const center = me ? [me.lat, me.lng] : DEFAULT_CENTER;

  return (
    <div>
      <div className="spread" style={{ margin: "24px 0 4px" }}>
        <h1 className="section-title" style={{ margin: 0 }}>Directorio de plomeros</h1>
      </div>
      <p className="muted" style={{ marginBottom: 20 }}>
        Filtrá por especialidad, zona y distancia. Cada reseña está anclada a un trabajo real y completado.
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
              placeholder="Nombre, especialidad o palabra clave"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && load()}
            />
          </div>
          <div className="field">
            <label>Especialidad</label>
            <select value={especialidad} onChange={(e) => setEspecialidad(e.target.value)}>
              <option value="">Todas las especialidades</option>
              {especialidades.map((e) => (
                <option key={e} value={e}>
                  {e}
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
              {loading ? "Buscando…" : `${plumbers.length} profesionales`}
            </span>
          </div>

          {plumbers.length === 0 && !loading && (
            <div className="card empty">No hay profesionales que coincidan con tu búsqueda.</div>
          )}

          <div className="worker-list">
            {plumbers.map((p) => (
              <Link to={`/plomero/${p.id}`} key={p.id} className="card worker">
                <div className="top">
                  <img className="avatar" src={p.fotoUrl || `https://i.pravatar.cc/100?u=${p.id}`} alt={p.name} />
                  <div>
                    <div className="name">{p.name}</div>
                    <StarsDisplay value={p.avgRating} count={p.reviewCount} />
                  </div>
                </div>
                <div className="chips">
                  {p.especialidad.map((e) => (
                    <span className="chip" key={e}>{e}</span>
                  ))}
                  {!p.disponible && <span className="chip chip-off">No disponible</span>}
                </div>
                <div className="muted" style={{ minHeight: 34 }}>
                  {p.descripcion ? p.descripcion.slice(0, 90) + (p.descripcion.length > 90 ? "…" : "") : "Sin descripción"}
                </div>
                <div className="meta-row">
                  <span>{p.completedJobs} trabajos hechos</span>
                  {p.distanceKm != null && (
                    <span className={`dist-tag ${p.inCoverage ? "dist-in" : "dist-out"}`}>
                      {p.distanceKm} km {p.inCoverage ? "· en zona" : ""}
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
