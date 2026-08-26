import { useEffect, useRef, useState } from "react";
import { MapContainer, TileLayer, useMap, useMapEvents } from "react-leaflet";
import Modal from "./Modal.jsx";
import { MapPinIcon } from "./Icons.jsx";

const CITY_ZOOM = 15;
const DEFAULT_CENTER = [-34.9011, -56.1645]; // Montevideo

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

export default function MapSearchModal({ initialCenter, onClose, onConfirm }) {
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
        setGeoMsg("No se pudo obtener tu ubicación. Mové el mapa para elegir la zona.");
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
    <Modal onClose={onClose} eyebrow="Buscar por el mapa" title="Elegí la zona donde buscar" wide>
      {(close) => (
        <>
          <p className="muted" style={{ marginTop: -6, marginBottom: 16 }}>
            Arrastrá el mapa para mover el punto, o usá tu ubicación actual. Los plomeros se buscan
            alrededor del punto marcado.
          </p>

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
                Buscar en esta zona
              </button>
            </div>
          </div>
        </>
      )}
    </Modal>
  );
}
