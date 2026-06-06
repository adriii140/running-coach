"use client";

import React, { useEffect, useRef } from "react";

interface ActivityMapProps {
  polyline: string;
  className?: string;
  interactive?: boolean;
  style?: React.CSSProperties;
}

export function ActivityMap({ polyline, className = "", interactive = false, style }: ActivityMapProps) {
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

      // Inicio (verde) y fin (rojo)
      if (interactive && coords.length > 0) {
        L.circleMarker(latLngs[0], {
          radius: 7,
          fillColor: "#22c55e",
          color: "#fff",
          weight: 2,
          fillOpacity: 1,
        }).addTo(map);
        L.circleMarker(latLngs[latLngs.length - 1], {
          radius: 7,
          fillColor: "#ef4444",
          color: "#fff",
          weight: 2,
          fillOpacity: 1,
        }).addTo(map);
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
    <div
      ref={containerRef}
      className={`bg-muted/30 rounded-lg overflow-hidden ${className}`}
      style={{ minHeight: 120, ...style }}
    />
  );
}

// Decodificador de polyline Google/Strava
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
