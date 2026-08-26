import { MapContainer, TileLayer, Marker, Popup, Circle, useMapEvents } from "react-leaflet";
import L from "leaflet";

// Íconos por defecto de Leaflet (se rompen con bundlers si no se apuntan a CDN).
const defaultIcon = new L.Icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

const meIcon = new L.Icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  className: "me-marker"
});

function ClickHandler({ onPick }) {
  useMapEvents({
    click(e) {
      if (onPick) onPick(e.latlng.lat, e.latlng.lng);
    }
  });
  return null;
}

export default function MapView({
  center,
  zoom = 12,
  markers = [],
  me = null,
  onPick = null,
  pickCoverageKm = null,
  tall = false
}) {
  return (
    <div className={tall ? "map-box map-tall" : "map-box"}>
      <MapContainer center={center} zoom={zoom} style={{ height: "100%", width: "100%" }}>
        <TileLayer
          attribution='&copy; OpenStreetMap'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
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

        {me && (
          <>
            <Marker position={[me.lat, me.lng]} icon={meIcon}>
              <Popup>{me.label || "Ubicación seleccionada"}</Popup>
            </Marker>
            {pickCoverageKm != null && (
              <Circle
                center={[me.lat, me.lng]}
                radius={pickCoverageKm * 1000}
                pathOptions={{ color: "#d9a52c", fillColor: "#d9a52c", fillOpacity: 0.12 }}
              />
            )}
          </>
        )}
      </MapContainer>
    </div>
  );
}
