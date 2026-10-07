import { MapContainer, TileLayer, Marker, Popup, Circle, Polyline, useMapEvents } from "react-leaflet";
import L from "leaflet";

// Íconos por defecto de Leaflet (se rompen con bundlers si no se apuntan a CDN).
const LEAFLET_IMG = "https://unpkg.com/leaflet@1.9.4/dist/images";
function makeIcon(className) {
  return new L.Icon({
    iconUrl: `${LEAFLET_IMG}/marker-icon.png`,
    iconRetinaUrl: `${LEAFLET_IMG}/marker-icon-2x.png`,
    shadowUrl: `${LEAFLET_IMG}/marker-shadow.png`,
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41],
    className
  });
}
const defaultIcon = makeIcon("");
const meIcon = makeIcon("me-marker");
const destinoIcon = makeIcon("destino-marker");

function ClickHandler({ onPick }) {
  useMapEvents({
    click(e) {
      if (onPick) onPick(e.latlng.lat, e.latlng.lng);
    }
  });
  return null;
}

/**
 * Mapa genérico.
 * - markers: [{ id, lat, lng, name, label }]
 * - me: punto destacado (+ círculo de cobertura opcional con pickCoverageKm)
 * - route: { origen: {lat,lng,label}, destino: {lat,lng,label} } dibuja el recorrido del flete
 */
export default function MapView({
  center,
  zoom = 12,
  markers = [],
  me = null,
  onPick = null,
  pickCoverageKm = null,
  route = null,
  tall = false
}) {
  const bounds =
    route?.origen && route?.destino
      ? L.latLngBounds([route.origen.lat, route.origen.lng], [route.destino.lat, route.destino.lng]).pad(0.3)
      : null;

  return (
    <div className={tall ? "map-box map-tall" : "map-box"}>
      <MapContainer
        // react-leaflet prioriza center/zoom sobre bounds: con recorrido se encuadran ambos puntos.
        center={bounds ? undefined : center}
        zoom={bounds ? undefined : zoom}
        bounds={bounds || undefined}
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer attribution="&copy; OpenStreetMap" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        {onPick && <ClickHandler onPick={onPick} />}

        {markers.map((m) => (
          <Marker key={m.id} position={[m.lat, m.lng]} icon={defaultIcon}>
            <Popup>
              <strong>{m.name}</strong>
              <br />
              {m.label}
            </Popup>
          </Marker>
        ))}

        {route?.origen && (
          <Marker position={[route.origen.lat, route.origen.lng]} icon={meIcon}>
            <Popup>Origen{route.origen.label ? `: ${route.origen.label}` : ""}</Popup>
          </Marker>
        )}
        {route?.destino && (
          <Marker position={[route.destino.lat, route.destino.lng]} icon={destinoIcon}>
            <Popup>Destino{route.destino.label ? `: ${route.destino.label}` : ""}</Popup>
          </Marker>
        )}
        {route?.origen && route?.destino && (
          <Polyline
            positions={[
              [route.origen.lat, route.origen.lng],
              [route.destino.lat, route.destino.lng]
            ]}
            pathOptions={{ color: "#111111", weight: 3, dashArray: "6 8" }}
          />
        )}

        {me && (
          <>
            <Marker position={[me.lat, me.lng]} icon={meIcon}>
              <Popup>{me.label || "Ubicación seleccionada"}</Popup>
            </Marker>
            {pickCoverageKm != null && (
              <Circle
                center={[me.lat, me.lng]}
                radius={pickCoverageKm * 1000}
                pathOptions={{ color: "#6b6b6b", fillColor: "#6b6b6b", fillOpacity: 0.08 }}
              />
            )}
          </>
        )}
      </MapContainer>
    </div>
  );
}
