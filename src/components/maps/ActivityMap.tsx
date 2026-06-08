"use client";

import React, { useEffect, useRef } from "react";

interface ActivityMapProps {
  polyline: string;
  className?: string;
  interactive?: boolean;
  style?: React.CSSProperties;
  averageHeartrate?: number | null;
}

export function ActivityMap({ polyline, className = "", interactive = false, style, averageHeartrate }: ActivityMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<unknown>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    let isMounted = true;

    async function initMap() {
      const L = (await import("leaflet")).default;
      await import("leaflet/dist/leaflet.css");

      if (!isMounted || !containerRef.current) return;

      // Decodificar polyline de Google/Strava
      const coords = decodePolyline(polyline);
      if (coords.length === 0) return;

      const map = L.map(containerRef.current, {
        zoomControl: interactive,
        scrollWheelZoom: interactive,
        dragging: interactive,
        touchZoom: interactive,
        doubleClickZoom: interactive,
        boxZoom: false,
        keyboard: false,
        attributionControl: false,
      });

      mapRef.current = map;

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
      }).addTo(map);

      const latLngs = coords.map(([lat, lng]) => L.latLng(lat, lng));
      const polylineLayer = L.polyline(latLngs, {
        color: "#f97316",
        weight: interactive ? 4 : 3,
        opacity: 0.9,
        lineJoin: "round",
        lineCap: "round",
      }).addTo(map);

      // Inicio (verde) y fin (rojo) + extras en modo interactivo
      if (interactive && coords.length > 0) {
        L.circleMarker(latLngs[0], {
          radius: 7,
          fillColor: "#22c55e",
          color: "#fff",
          weight: 2,
          fillOpacity: 1,
        }).addTo(map).bindTooltip("Inicio", { permanent: false });

        L.circleMarker(latLngs[latLngs.length - 1], {
          radius: 7,
          fillColor: "#ef4444",
          color: "#fff",
          weight: 2,
          fillOpacity: 1,
        }).addTo(map).bindTooltip("Fin", { permanent: false });

        // ── Marcadores de kilómetro ──
        let cumDistM = 0;
        let nextKm = 1;
        for (let i = 1; i < coords.length; i++) {
          const segDist = haversineM(coords[i - 1], coords[i]);
          cumDistM += segDist;
          if (cumDistM >= nextKm * 1000) {
            const km = nextKm;
            const kmIcon = L.divIcon({
              html: `<div style="
                background:#f97316;color:#fff;font-size:10px;font-weight:700;
                border:2px solid #fff;border-radius:50%;width:20px;height:20px;
                display:flex;align-items:center;justify-content:center;
                box-shadow:0 1px 4px rgba(0,0,0,0.4);line-height:1;
              ">${km}</div>`,
              iconSize: [20, 20],
              iconAnchor: [10, 10],
              className: "",
            });
            L.marker(latLngs[i], { icon: kmIcon })
              .addTo(map)
              .bindTooltip(`${km} km`, { permanent: false });
            nextKm++;
          }
        }

        // ── Flechas de dirección (cada ~20% de la ruta) ──
        const arrowCount = 4;
        const step = Math.max(1, Math.floor(coords.length / (arrowCount + 1)));
        for (let k = 1; k <= arrowCount; k++) {
          const idx = k * step;
          if (idx >= coords.length - 1) break;
          const bearing = calcBearing(coords[idx], coords[Math.min(idx + 3, coords.length - 1)]);
          const arrowIcon = L.divIcon({
            html: `<div style="width:20px;height:20px;background:#f97316;border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 4px rgba(0,0,0,0.5);transform:rotate(${bearing}deg);"><div style="width:0;height:0;border-left:5px solid transparent;border-right:5px solid transparent;border-bottom:10px solid white;margin-top:-2px;"></div></div>`,
            iconSize: [20, 20],
            iconAnchor: [10, 10],
            className: "",
          });
          L.marker(latLngs[idx], { icon: arrowIcon, interactive: false }).addTo(map);
        }
      }

      map.fitBounds(polylineLayer.getBounds(), { padding: [interactive ? 20 : 8, interactive ? 20 : 8] });
    }

    initMap();

    return () => {
      isMounted = false;
      if (mapRef.current) {
        (mapRef.current as { remove: () => void }).remove();
        mapRef.current = null;
      }
    };
  }, [polyline, interactive]);

  return (
    <div className="relative">
      <div
        ref={containerRef}
        className={`bg-muted/30 rounded-lg overflow-hidden ${className}`}
        style={{ minHeight: 120, ...style }}
      />
      {/* Badge de ppm medias superpuesto */}
      {interactive && averageHeartrate && (
        <div className="absolute top-2 right-2 z-[1000] bg-background/90 backdrop-blur-sm border border-border/50 rounded-lg px-2 py-1 flex items-center gap-1 text-xs font-semibold shadow">
          <span className="text-red-400">♥</span>
          <span>{Math.round(averageHeartrate)} ppm</span>
        </div>
      )}
    </div>
  );
}

// ─── Decodificador de polyline Google/Strava ───
function decodePolyline(encoded: string): [number, number][] {
  const coords: [number, number][] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let b: number;
    let shift = 0;
    let result = 0;

    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);

    const dLat = result & 1 ? ~(result >> 1) : result >> 1;
    lat += dLat;

    shift = 0;
    result = 0;

    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);

    const dLng = result & 1 ? ~(result >> 1) : result >> 1;
    lng += dLng;

    coords.push([lat / 1e5, lng / 1e5]);
  }

  return coords;
}

// ─── Distancia Haversine en metros ───
function haversineM([lat1, lng1]: [number, number], [lat2, lng2]: [number, number]): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ─── Rumbo entre dos coordenadas (grados, 0=Norte) ───
function calcBearing([lat1, lng1]: [number, number], [lat2, lng2]: [number, number]): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLng = toRad(lng2 - lng1);
  const y = Math.sin(dLng) * Math.cos(toRad(lat2));
  const x =
    Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
    Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(dLng);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}
