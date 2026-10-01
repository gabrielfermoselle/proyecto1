import { useEffect, useRef, useState } from "react";
import { MapContainer, TileLayer, useMap, useMapEvents } from "react-leaflet";
import Modal from "./Modal.jsx";
import { MapPinIcon } from "./Icons.jsx";

const CITY_ZOOM = 15;
import { CENTRO_TUCUMAN } from "../utils/catalogos.js";

const DEFAULT_CENTER = CENTRO_TUCUMAN;

function MapController({ mapRef }) {
  const map = useMap();
  useEffect(() => {
    mapRef.current = map;
  }, [map, mapRef]);
  return null;
}

function CenterTracker({ onSettle, onMoveStart }) {
  useMapEvents({
    movestart() {
      onMoveStart();
    },
    moveend(e) {
      const c = e.target.getCenter();
      onSettle(c.lat, c.lng);
    }
  });
  return null;
}

export default function MapSearchModal({
  initialCenter,
  onClose,
  onConfirm,
  eyebrow = "Mapa",
  title = "Elegí un punto",
  confirmLabel = "Buscar en esta zona"
}) {
  const mapRef = useRef(null);
  const [center, setCenter] = useState(initialCenter || DEFAULT_CENTER);
  const [dragging, setDragging] = useState(false);
  const [locating, setLocating] = useState(false);
  const [geoMsg, setGeoMsg] = useState("");

  function flyHere(lat, lng, zoom = CITY_ZOOM) {
    setCenter([lat, lng]);
    mapRef.current?.flyTo([lat, lng], zoom, { duration: 0.6 });
  }

  function useMyLocation() {
    if (!navigator.geolocation) {
      setGeoMsg("Tu navegador no soporta geolocalización.");
      return;
    }
    setLocating(true);
    setGeoMsg("");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        flyHere(pos.coords.latitude, pos.coords.longitude);
        setLocating(false);
      },
      () => {
        setGeoMsg("No se pudo obtener tu ubicación.");
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }

  // Al abrir el modal, si todavía no hay una ubicación conocida, la pedimos enseguida.
  useEffect(() => {
    if (!initialCenter) useMyLocation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Modal onClose={onClose} eyebrow={eyebrow} title={title} wide>
      {(close) => (
        <>
          <div className="map-picker">
            <div className="map-picker-map">
              <MapContainer
                center={center}
                zoom={CITY_ZOOM}
                style={{ height: "100%", width: "100%" }}
                zoomControl={false}
              >
                <TileLayer
                  attribution='&copy; OpenStreetMap &copy; CARTO'
                  url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
                />
                <MapController mapRef={mapRef} />
                <CenterTracker
                  onMoveStart={() => setDragging(true)}
                  onSettle={(lat, lng) => {
                    setCenter([lat, lng]);
                    setDragging(false);
                  }}
                />
              </MapContainer>

              <div className={`map-picker-pin ${dragging ? "is-dragging" : ""}`} aria-hidden="true">
                <MapPinIcon width={34} height={34} />
                <span className="map-picker-pin-shadow" />
              </div>

              <button
                type="button"
                className="btn ghost sm map-picker-locate"
                onClick={useMyLocation}
                disabled={locating}
              >
                {locating ? "Ubicando…" : "📍 Mi ubicación"}
              </button>
            </div>

            <div className="map-picker-footer">
              <div>
                <div className="map-picker-coords">
                  Lat {center[0].toFixed(4)} · Lng {center[1].toFixed(4)}
                </div>
                {geoMsg && <div className="muted" style={{ marginTop: 2 }}>{geoMsg}</div>}
              </div>
              <button
                type="button"
                className="btn gold"
                onClick={() => {
                  onConfirm(center[0], center[1]);
                  close();
                }}
              >
                {confirmLabel}
              </button>
            </div>
          </div>
        </>
      )}
    </Modal>
  );
}
