"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
  MapPin, Loader2, Navigation, RotateCcw, Bot,
  Mountain, Clock, TrendingUp, Download
} from "lucide-react";

interface GeneratedRoute {
  geometry: [number, number][];
  distanceKm: number;
  elevationM: number;
  durationMin: number;
}

const SURFACE_OPTIONS = [
  { value: "asphalt", label: "Asfalto" },
  { value: "trail",   label: "Trail / montaña" },
  { value: "mixed",   label: "Mixto" },
];

const DISTANCE_PRESETS = [3, 5, 8, 10, 15, 21];

export function RouteGeneratorMap() {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<unknown>(null);
  const markerRef = useRef<unknown>(null);
  const routeLayerRef = useRef<unknown>(null);

  const [startPoint, setStartPoint] = useState<{ lat: number; lng: number } | null>(null);
  const [distanceKm, setDistanceKm] = useState(10);
  const [surface, setSurface] = useState("asphalt");
  const [routeType, setRouteType] = useState<"loop" | "outback">("loop");
  const [loading, setLoading] = useState(false);
  const [locating, setLocating] = useState(false);
  const [route, setRoute] = useState<GeneratedRoute | null>(null);
  const [aiRecommendation, setAiRecommendation] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Init mapa
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;
    let isMounted = true;

    async function init() {
      const L = (await import("leaflet")).default;
      await import("leaflet/dist/leaflet.css");
      if (!isMounted || !mapContainerRef.current) return;

      const map = L.map(mapContainerRef.current, {
        center: [40.4168, -3.7038], // Madrid por defecto
        zoom: 13,
        zoomControl: true,
      });

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "© OpenStreetMap",
      }).addTo(map);

      // Click en el mapa → establecer punto de inicio
      map.on("click", (e: { latlng: { lat: number; lng: number } }) => {
        const { lat, lng } = e.latlng;
        setStartPoint({ lat, lng });

        // Actualizar o crear marcador
        if (markerRef.current) {
          (markerRef.current as { setLatLng: (ll: [number, number]) => void }).setLatLng([lat, lng]);
        } else {
          const icon = L.divIcon({
            html: `<div style="background:#f97316;border:3px solid white;border-radius:50%;width:20px;height:20px;box-shadow:0 2px 8px rgba(0,0,0,0.4)"></div>`,
            iconSize: [20, 20],
            iconAnchor: [10, 10],
            className: "",
          });
          markerRef.current = L.marker([lat, lng], { icon }).addTo(map);
        }
      });

      mapRef.current = map;
    }

    init();
    return () => { isMounted = false; };
  }, []);

  // Dibujar ruta en el mapa
  const drawRoute = useCallback(async (geometry: [number, number][]) => {
    const L = (await import("leaflet")).default;
    const map = mapRef.current as { removeLayer: (l: unknown) => void; fitBounds: (b: unknown, o: object) => void } | null;
    if (!map) return;

    if (routeLayerRef.current) {
      map.removeLayer(routeLayerRef.current);
    }

    const latLngs = geometry.map(([lat, lng]) => L.latLng(lat, lng));
    const polyline = L.polyline(latLngs, {
      color: "#f97316",
      weight: 5,
      opacity: 0.9,
      lineJoin: "round",
      lineCap: "round",
    }).addTo(map as unknown as import("leaflet").Map);

    routeLayerRef.current = polyline;
    map.fitBounds(polyline.getBounds(), { padding: [40, 40] });
  }, []);

  useEffect(() => {
    if (route?.geometry) {
      drawRoute(route.geometry);
    }
  }, [route, drawRoute]);

  // Geolocalización
  const geolocate = useCallback(() => {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        setStartPoint({ lat, lng });
        setLocating(false);

        const L = (await import("leaflet")).default;
        const map = mapRef.current as { setView: (ll: [number, number], z: number) => void; removeLayer: (l: unknown) => void } | null;
        if (!map) return;

        map.setView([lat, lng], 14);

        if (markerRef.current) {
          map.removeLayer(markerRef.current);
        }
        const icon = L.divIcon({
          html: `<div style="background:#f97316;border:3px solid white;border-radius:50%;width:20px;height:20px;box-shadow:0 2px 8px rgba(0,0,0,0.4)"></div>`,
          iconSize: [20, 20], iconAnchor: [10, 10], className: "",
        });
        markerRef.current = L.marker([lat, lng], { icon }).addTo(map as unknown as import("leaflet").Map);
      },
      () => setLocating(false)
    );
  }, []);

  const generateRoute = useCallback(async () => {
    if (!startPoint) return;
    setLoading(true);
    setError(null);
    setRoute(null);
    setAiRecommendation(null);

    try {
      const res = await fetch("/api/routes/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lat: startPoint.lat,
          lng: startPoint.lng,
          distanceKm,
          surface,
          routeType,
          askAI: true,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error generando ruta");

      setRoute(data.route);
      if (data.aiRecommendation) setAiRecommendation(data.aiRecommendation);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setLoading(false);
    }
  }, [startPoint, distanceKm, surface, routeType]);

  const reset = () => {
    setRoute(null);
    setAiRecommendation(null);
    setError(null);
    if (routeLayerRef.current && mapRef.current) {
      (mapRef.current as { removeLayer: (l: unknown) => void }).removeLayer(routeLayerRef.current);
      routeLayerRef.current = null;
    }
  };

  return (
    <div className="flex flex-col lg:flex-row gap-4 h-[calc(100vh-10rem)]">
      {/* Panel lateral */}
      <div className="lg:w-80 shrink-0 space-y-4 overflow-y-auto">
        {/* Punto de inicio */}
        <div className="rounded-xl border border-border/50 bg-card/40 p-4 space-y-3">
          <h3 className="font-semibold text-sm flex items-center gap-2">
            <MapPin className="h-4 w-4 text-orange-400" />
            Punto de salida
          </h3>
          <button
            onClick={geolocate}
            disabled={locating}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-border/60 text-sm hover:bg-muted/40 transition-colors disabled:opacity-50"
          >
            {locating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Navigation className="h-4 w-4" />}
            Usar mi ubicación
          </button>
          {startPoint ? (
            <p className="text-xs text-green-400 flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              {startPoint.lat.toFixed(5)}, {startPoint.lng.toFixed(5)}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">O haz clic en el mapa</p>
          )}
        </div>

        {/* Parámetros */}
        <div className="rounded-xl border border-border/50 bg-card/40 p-4 space-y-4">
          <h3 className="font-semibold text-sm">Configuración</h3>

          {/* Distancia */}
          <div className="space-y-2">
            <label className="text-xs text-muted-foreground">Distancia: {distanceKm} km</label>
            <input
              type="range" min={2} max={42} step={0.5}
              value={distanceKm}
              onChange={(e) => setDistanceKm(parseFloat(e.target.value))}
              className="w-full accent-orange-500"
            />
            <div className="flex gap-1 flex-wrap">
              {DISTANCE_PRESETS.map((d) => (
                <button
                  key={d}
                  onClick={() => setDistanceKm(d)}
                  className={`px-2 py-0.5 rounded text-xs border transition-colors ${distanceKm === d ? "bg-orange-500/20 border-orange-500/50 text-orange-400" : "border-border/50 text-muted-foreground hover:border-border"}`}
                >
                  {d}k
                </button>
              ))}
            </div>
          </div>

          {/* Tipo de ruta */}
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">Tipo de ruta</label>
            <div className="grid grid-cols-2 gap-2">
              {[{ v: "loop", l: "Circular" }, { v: "outback", l: "Ida y vuelta" }].map(({ v, l }) => (
                <button
                  key={v}
                  onClick={() => setRouteType(v as "loop" | "outback")}
                  className={`py-1.5 rounded-lg text-xs border transition-colors ${routeType === v ? "bg-orange-500/20 border-orange-500/50 text-orange-400" : "border-border/50 text-muted-foreground hover:border-border"}`}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>

          {/* Superficie */}
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">Superficie</label>
            <div className="space-y-1">
              {SURFACE_OPTIONS.map((opt) => (
                <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="surface"
                    value={opt.value}
                    checked={surface === opt.value}
                    onChange={() => setSurface(opt.value)}
                    className="accent-orange-500"
                  />
                  <span className="text-sm">{opt.label}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* Botón generar */}
        <button
          onClick={generateRoute}
          disabled={!startPoint || loading}
          className="w-full py-3 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-semibold text-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
        >
          {loading ? (
            <><Loader2 className="h-4 w-4 animate-spin" /> Generando ruta...</>
          ) : (
            <><TrendingUp className="h-4 w-4" /> Generar ruta</>
          )}
        </button>

        {error && (
          <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
            {error.includes("OPENROUTESERVICE_API_KEY") ? (
              <>Necesitas una API key gratuita de <a href="https://openrouteservice.org/dev/#/signup" target="_blank" rel="noopener noreferrer" className="underline">openrouteservice.org</a> — añade OPENROUTESERVICE_API_KEY en .env.local</>
            ) : error}
          </div>
        )}

        {/* Stats de la ruta generada */}
        {route && (
          <div className="rounded-xl border border-orange-500/30 bg-orange-500/5 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-sm text-orange-400">Ruta generada</h3>
              <button onClick={reset} className="text-muted-foreground hover:text-foreground transition-colors">
                <RotateCcw className="h-4 w-4" />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <p className="text-lg font-bold">{route.distanceKm}</p>
                <p className="text-xs text-muted-foreground">km</p>
              </div>
              <div>
                <p className="text-lg font-bold flex items-center justify-center gap-0.5">
                  <Mountain className="h-4 w-4" />{route.elevationM}
                </p>
                <p className="text-xs text-muted-foreground">m D+</p>
              </div>
              <div>
                <p className="text-lg font-bold flex items-center justify-center gap-0.5">
                  <Clock className="h-4 w-4" />{route.durationMin}
                </p>
                <p className="text-xs text-muted-foreground">min est.</p>
              </div>
            </div>
          </div>
        )}

        {/* Recomendación del Coach */}
        {aiRecommendation && (
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-2">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Bot className="h-4 w-4 text-primary" />
              Coach AI dice:
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">{aiRecommendation}</p>
          </div>
        )}
      </div>

      {/* Mapa */}
      <div className="flex-1 rounded-xl overflow-hidden border border-border/50 relative min-h-[400px]">
        <div ref={mapContainerRef} className="w-full h-full" />
        {!startPoint && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="bg-background/80 backdrop-blur-sm rounded-xl px-4 py-3 text-sm text-muted-foreground border border-border/50 text-center">
              <MapPin className="h-5 w-5 mx-auto mb-1 text-orange-400" />
              Haz clic en el mapa para elegir el punto de salida
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
