"use client";

import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import { useEffect } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Fix Leaflet default marker icons broken by webpack
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl:       "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl:     "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

const riskColor: Record<string, string> = {
  Low:         "#22c55e",
  Medium:      "#eab308",
  High:        "#f97316",
  "Very High": "#ef4444",
  Critical:    "#991b1b",
};

function createRiskIcon(riskLevel?: string) {
  const color = riskLevel ? (riskColor[riskLevel] ?? "#3b82f6") : "#3b82f6";
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="42" viewBox="0 0 32 42">
      <path d="M16 0C7.163 0 0 7.163 0 16c0 10 16 26 16 26S32 26 32 16C32 7.163 24.837 0 16 0z"
        fill="${color}" stroke="white" stroke-width="2"/>
      <circle cx="16" cy="16" r="6" fill="white"/>
    </svg>`;
  return L.divIcon({
    html: svg,
    className: "",
    iconSize:   [32, 42],
    iconAnchor: [16, 42],
    popupAnchor:[0, -42],
  });
}

// Re-center map when coords change
function MapController({ lat, lon }: { lat: number; lon: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView([lat, lon], 13, { animate: true });
  }, [lat, lon, map]);
  return null;
}

interface FloodMapProps {
  lat: number;
  lon: number;
  riskLevel?: string;
}

export default function FloodMap({ lat, lon, riskLevel }: FloodMapProps) {
  return (
    <MapContainer
      center={[lat, lon]}
      zoom={13}
      style={{ width: "100%", height: "100%" }}
      scrollWheelZoom
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      <MapController lat={lat} lon={lon} />

      <Marker position={[lat, lon]} icon={createRiskIcon(riskLevel)}>
        <Popup>
          <div className="text-sm space-y-1">
            <p className="font-semibold">📍 Analysis Location</p>
            <p>Lat: {lat.toFixed(5)}</p>
            <p>Lon: {lon.toFixed(5)}</p>
            {riskLevel && (
              <p>Risk: <span className="font-semibold">{riskLevel}</span></p>
            )}
          </div>
        </Popup>
      </Marker>
    </MapContainer>
  );
}
