"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
  MapPin, Loader2, Navigation, RotateCcw, Bot,
  Mountain, Clock, TrendingUp, Search, X,
  PenLine, Trash2, ChevronDown, ChevronUp,
  AlertTriangle, ArrowDown, Map, Bookmark, Check,
  CornerDownLeft, CornerDownRight, MoveRight, RotateCw, Download,
  Sparkles, Zap, Timer, Activity,
} from "lucide-react";

interface AIRouteParams {
  distanceKm: number;
  maxElevationM: number;
  sessionType: "recovery" | "easy" | "tempo" | "intervals" | "long";
  intensity: string;
  targetPaceMinKm: string;
  reasoning: string;
}

const SESSION_TYPE_LABELS: Record<string, { label: string; color: string }> = {
  recovery: { label: "Recuperación", color: "text-blue-400" },
  easy:     { label: "Rodaje fácil", color: "text-green-400" },
  tempo:    { label: "Tempo / umbral", color: "text-orange-400" },
  intervals:{ label: "Series", color: "text-red-400" },
  long:     { label: "Tirada larga", color: "text-purple-400" },
};

interface NominatimResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
}

interface RouteStep {
  instruction: string;
  distance: number;   // metros
  duration: number;   // segundos
  type: number;
  name: string;
}

interface GeneratedRoute {
  geometry: [number, number][];
  distanceKm: number;
  elevationM: number;
  elevationLossM: number;
  durationMin: number;
  steps: RouteStep[];
  elevationExceeded?: boolean;
}

const SURFACE_OPTIONS = [
  { value: "asphalt", label: "Asfalto" },
  { value: "trail", label: "Trail / montaña" },
  { value: "mixed", label: "Mixto" },
];

const DISTANCE_PRESETS = [3, 5, 8, 10, 15, 21];

// ── Icono según tipo de maniobra ORS ──
function StepIcon({ type }: { type: number }) {
  // ORS type: 0=left, 1=right, 2=sharp-left, 3=sharp-right, 4=slight-left, 5=slight-right,
  // 6=straight, 7=roundabout, 10=depart, 11=arrive, 12=u-turn
  if (type === 0 || type === 2 || type === 4) return <CornerDownLeft className="h-3.5 w-3.5 text-blue-400 shrink-0" />;
  if (type === 1 || type === 3 || type === 5) return <CornerDownRight className="h-3.5 w-3.5 text-orange-400 shrink-0" />;
  if (type === 7) return <RotateCw className="h-3.5 w-3.5 text-purple-400 shrink-0" />;
  if (type === 11) return <MapPin className="h-3.5 w-3.5 text-green-400 shrink-0" />;
  return <MoveRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />;
}

function fmtDist(m: number): string {
  if (m >= 1000) return `${(m / 1000).toFixed(1)} km`;
  return `${m} m`;
}

function RouteStepsList({ steps }: { steps: RouteStep[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-xl border border-border/50 bg-card/40 overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors"
      >
        <span className="font-semibold text-sm flex items-center gap-2">
          <Navigation className="h-4 w-4 text-orange-400" />
          Instrucciones ({steps.length} pasos)
        </span>
        {open
          ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
          : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
      </button>
      {open && (
        <div className="px-3 pb-3 space-y-0.5 max-h-72 overflow-y-auto">
          {steps.map((step, i) => (
            <div key={i} className="flex items-start gap-2.5 py-2 border-b border-border/30 last:border-0">
              <StepIcon type={step.type} />
              <div className="flex-1 min-w-0">
                <p className="text-xs leading-snug">{step.instruction}</p>
                {step.name && step.name !== "-" && (
                  <p className="text-[10px] text-muted-foreground/70 mt-0.5 truncate">{step.name}</p>
                )}
              </div>
              <span className="text-[10px] text-muted-foreground shrink-0 tabular-nums pt-0.5">
                {fmtDist(step.distance)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Collapsible section wrapper
function Section({
  title, icon, children, defaultOpen = true,
}: {
  title: string; icon: React.ReactNode; children: React.ReactNode; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-xl border border-border/50 bg-card/40 overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors"
      >
        <span className="font-semibold text-sm flex items-center gap-2">
          {icon}{title}
        </span>
        {open ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
      </button>
      {open && <div className="px-4 pb-4 space-y-3">{children}</div>}
    </div>
  );
}

interface RouteGeneratorMapProps {
  lastRunLat?: number | null;
  lastRunLng?: number | null;
}

export function RouteGeneratorMap({ lastRunLat, lastRunLng }: RouteGeneratorMapProps = {}) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<unknown>(null);
  const markerRef = useRef<unknown>(null);
  const routeLayerRef = useRef<unknown>(null);
  const routeExtrasRef = useRef<unknown[]>([]); // km markers + arrows
  const userMarkerRef = useRef<unknown>(null);
  const watchIdRef = useRef<number | null>(null);

  // Zone drawing refs (need refs to access inside Leaflet event handlers)
  const drawingZoneRef = useRef(false);
  const zoneVerticesRef = useRef<[number, number][]>([]);
  const zonePolygonLayerRef = useRef<unknown>(null);
  const zonePreviewPolylineRef = useRef<unknown>(null);
  const zoneVertexMarkersRef = useRef<unknown[]>([]);

  // State
  const [startPoint, setStartPoint] = useState<{ lat: number; lng: number } | null>(null);
  const [distanceKm, setDistanceKm] = useState(10);
  const [preference, setPreference] = useState<"recommended" | "shortest">("recommended");
  const [avoidSteps, setAvoidSteps] = useState(false);
  const [avoidFerries, setAvoidFerries] = useState(false);
  const [avoidFords, setAvoidFords] = useState(false);
  const [limitElevation, setLimitElevation] = useState(false);
  const [maxElevationGainM, setMaxElevationGainM] = useState(300);

  const [loading, setLoading] = useState(false);
  const [locating, setLocating] = useState(false);
  const [route, setRoute] = useState<GeneratedRoute | null>(null);
  const [aiRecommendation, setAiRecommendation] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [tracking, setTracking] = useState(false);

  // Modo IA
  const [aiMode, setAiMode] = useState(false);
  const [aiParams, setAiParams] = useState<AIRouteParams | null>(null);
  const [loadingAiParams, setLoadingAiParams] = useState(false);

  // Zone drawing state
  const [drawingZone, setDrawingZone] = useState(false);
  const [zoneActive, setZoneActive] = useState(false);
  const [zoneVertexCount, setZoneVertexCount] = useState(0);

  // Mobile sidebar

  // Search
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<NominatimResult[]>([]);
  const [searching, setSearching] = useState(false);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Sync drawingZone ref
  useEffect(() => { drawingZoneRef.current = drawingZone; }, [drawingZone]);

  // ---------- Map init ----------
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;
    let isMounted = true;

    async function init() {
      const L = (await import("leaflet")).default;
      await import("leaflet/dist/leaflet.css");
      if (!isMounted || !mapContainerRef.current) return;

      // Centrar en última carrera o Madrid por defecto
      const defaultCenter: [number, number] = (lastRunLat && lastRunLng)
        ? [lastRunLat, lastRunLng]
        : [40.4168, -3.7038];
      const defaultZoom = (lastRunLat && lastRunLng) ? 14 : 13;

      const map = L.map(mapContainerRef.current, {
        center: defaultCenter,
        zoom: defaultZoom,
        zoomControl: true,
      });

      // Si hay última carrera, mostrar marcador clicable para usarlo como salida
      if (lastRunLat && lastRunLng) {
        const refIcon = L.divIcon({
          html: `<div style="background:#f97316;border:2px solid white;border-radius:50%;width:14px;height:14px;opacity:0.6;cursor:pointer;box-shadow:0 1px 4px rgba(0,0,0,0.3)"></div>`,
          iconSize: [14, 14], iconAnchor: [7, 7], className: "",
        });
        const refMarker = L.marker([lastRunLat, lastRunLng], { icon: refIcon })
          .addTo(map)
          .bindTooltip("📍 Última salida — clic para usar", { permanent: false });

        refMarker.on("click", () => {
          setStartPoint({ lat: lastRunLat, lng: lastRunLng });
          // Reusar el marcador de salida naranja grande
          const startIcon = L.divIcon({
            html: `<div style="background:#f97316;border:3px solid white;border-radius:50%;width:20px;height:20px;box-shadow:0 2px 8px rgba(0,0,0,0.4)"></div>`,
            iconSize: [20, 20], iconAnchor: [10, 10], className: "",
          });
          if (markerRef.current) {
            (markerRef.current as { setLatLng: (ll: [number, number]) => void }).setLatLng([lastRunLat, lastRunLng]);
          } else {
            markerRef.current = L.marker([lastRunLat, lastRunLng], { icon: startIcon }).addTo(map);
          }
          map.removeLayer(refMarker);
        });
      }

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "© OpenStreetMap",
      }).addTo(map);

      map.on("click", async (e: { latlng: { lat: number; lng: number } }) => {
        const { lat, lng } = e.latlng;

        if (drawingZoneRef.current) {
          // Add zone vertex
          const vertices = zoneVerticesRef.current;
          vertices.push([lat, lng]);
          setZoneVertexCount(vertices.length);

          // Small vertex marker
          const dotIcon = L.divIcon({
            html: `<div style="background:#3b82f6;border:2px solid white;border-radius:50%;width:10px;height:10px"></div>`,
            iconSize: [10, 10], iconAnchor: [5, 5], className: "",
          });
          const vm = L.marker([lat, lng], { icon: dotIcon }).addTo(map);
          zoneVertexMarkersRef.current.push(vm);

          // Update preview polyline
          if (zonePreviewPolylineRef.current) {
            map.removeLayer(zonePreviewPolylineRef.current as Parameters<typeof map.removeLayer>[0]);
          }
          if (vertices.length > 1) {
            const preview = L.polyline(vertices as [number, number][], {
              color: "#3b82f6", weight: 2, dashArray: "5,5", opacity: 0.8,
            }).addTo(map);
            zonePreviewPolylineRef.current = preview;
          }
          return;
        }

        // Normal mode: set start point
        setStartPoint({ lat, lng });

        const icon = L.divIcon({
          html: `<div style="background:#f97316;border:3px solid white;border-radius:50%;width:20px;height:20px;box-shadow:0 2px 8px rgba(0,0,0,0.4)"></div>`,
          iconSize: [20, 20], iconAnchor: [10, 10], className: "",
        });
        if (markerRef.current) {
          (markerRef.current as { setLatLng: (ll: [number, number]) => void }).setLatLng([lat, lng]);
        } else {
          markerRef.current = L.marker([lat, lng], { icon }).addTo(map);
        }
      });

      mapRef.current = map;
    }

    init();
    return () => { isMounted = false; };
  }, []);

  // ---------- Draw route on map ----------
  const drawRoute = useCallback(async (geometry: [number, number][]) => {
    const L = (await import("leaflet")).default;
    const map = mapRef.current as { removeLayer: (l: unknown) => void; fitBounds: (b: unknown, o: object) => void } | null;
    if (!map) return;

    // Limpiar capa anterior y extras
    if (routeLayerRef.current) map.removeLayer(routeLayerRef.current);
    routeExtrasRef.current.forEach((l) => map.removeLayer(l));
    routeExtrasRef.current = [];

    const latLngs = geometry.map(([lat, lng]) => L.latLng(lat, lng));
    const polyline = L.polyline(latLngs, {
      color: "#f97316", weight: 5, opacity: 0.9, lineJoin: "round", lineCap: "round",
    }).addTo(map as unknown as import("leaflet").Map);

    routeLayerRef.current = polyline;
    map.fitBounds((polyline as unknown as { getBounds: () => unknown }).getBounds(), { padding: [40, 40] });

    // ── Helpers de distancia ──
    const haversineM = (a: [number,number], b: [number,number]) => {
      const dLat = (b[0]-a[0]) * Math.PI / 180;
      const dLng = (b[1]-a[1]) * Math.PI / 180;
      const s = Math.sin(dLat/2)**2 +
        Math.cos(a[0]*Math.PI/180) * Math.cos(b[0]*Math.PI/180) * Math.sin(dLng/2)**2;
      return 6371000 * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1-s));
    };
    const calcBearing = (a: [number,number], b: [number,number]) => {
      const toR = (d: number) => d * Math.PI / 180;
      const dLng = toR(b[1] - a[1]);
      const y = Math.sin(dLng) * Math.cos(toR(b[0]));
      const x = Math.cos(toR(a[0])) * Math.sin(toR(b[0])) -
                Math.sin(toR(a[0])) * Math.cos(toR(b[0])) * Math.cos(dLng);
      return ((Math.atan2(y, x) * 180 / Math.PI) + 360) % 360;
    };

    const lMap = map as unknown as import("leaflet").Map;

    // ── Recorrer la geometría acumulando distancia para km markers y flechas ──
    // Estrategia: km markers en 1,2,3... km exactos.
    //             Flechas en los PUNTOS MEDIOS entre km markers (0.5, 1.5, 2.5...).
    //             Así nunca coinciden.

    // Primero: calcular longitud total
    let totalRouteM = 0;
    for (let i = 1; i < geometry.length; i++) totalRouteM += haversineM(geometry[i-1], geometry[i]);
    const totalRouteKm = Math.floor(totalRouteM / 1000);

    // Targets: km markers + midpoints (arrows)
    interface DistTarget { distM: number; type: "km"; km: number }
    interface ArrowTarget { distM: number; type: "arrow" }
    type Target = DistTarget | ArrowTarget;
    const targets: Target[] = [];
    for (let k = 1; k <= totalRouteKm; k++) {
      targets.push({ distM: k * 1000, type: "km", km: k });
      if (k * 1000 + 500 < totalRouteM) {
        targets.push({ distM: k * 1000 - 500, type: "arrow" }); // 500m antes del km = midpoint entre (k-1) y k
      }
    }
    // Flecha inicial a 500m si hay al menos 1km
    if (totalRouteM > 600) targets.push({ distM: 500, type: "arrow" });
    targets.sort((a, b) => a.distM - b.distM);

    let cumM = 0;
    let tIdx = 0;
    for (let i = 1; i < geometry.length && tIdx < targets.length; i++) {
      const segM = haversineM(geometry[i-1], geometry[i]);
      while (tIdx < targets.length && cumM + segM >= targets[tIdx].distM) {
        const target = targets[tIdx];
        const frac = Math.max(0, Math.min(1, (target.distM - cumM) / segM));
        const lat = geometry[i-1][0] + frac * (geometry[i][0] - geometry[i-1][0]);
        const lng = geometry[i-1][1] + frac * (geometry[i][1] - geometry[i-1][1]);
        // Bearing: usar el segmento actual
        const nextIdx = Math.min(i + 2, geometry.length - 1);
        const bearing = calcBearing([lat, lng], geometry[nextIdx]);

        if (target.type === "km") {
          const kmIcon = L.divIcon({
            html: `<div style="background:#1e293b;color:#f97316;font-size:10px;font-weight:800;border:2px solid #f97316;border-radius:50%;width:22px;height:22px;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 4px rgba(0,0,0,0.6);line-height:1;">${target.km}</div>`,
            iconSize: [22, 22], iconAnchor: [11, 11], className: "",
          });
          routeExtrasRef.current.push(L.marker([lat, lng], { icon: kmIcon }).addTo(lMap));
        } else {
          const arrowIcon = L.divIcon({
            html: `<div style="width:20px;height:20px;background:#f97316;border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 4px rgba(0,0,0,0.5);transform:rotate(${bearing}deg);"><div style="width:0;height:0;border-left:5px solid transparent;border-right:5px solid transparent;border-bottom:10px solid white;margin-top:-2px;"></div></div>`,
            iconSize: [20, 20], iconAnchor: [10, 10], className: "",
          });
          routeExtrasRef.current.push(L.marker([lat, lng], { icon: arrowIcon, interactive: false }).addTo(lMap));
        }
        tIdx++;
      }
      cumM += segM;
    }
  }, []);

  useEffect(() => {
    if (route?.geometry) drawRoute(route.geometry);
  }, [route, drawRoute]);

  // ---------- Zone drawing ----------
  const startDrawingZone = () => {
    setDrawingZone(true);
    setZoneActive(false);
    // Clear existing zone
    clearZoneLayers();
    zoneVerticesRef.current = [];
    setZoneVertexCount(0);
  };

  const clearZoneLayers = useCallback(async () => {
    const map = mapRef.current as { removeLayer: (l: unknown) => void } | null;
    if (!map) return;
    if (zonePolygonLayerRef.current) {
      map.removeLayer(zonePolygonLayerRef.current);
      zonePolygonLayerRef.current = null;
    }
    if (zonePreviewPolylineRef.current) {
      map.removeLayer(zonePreviewPolylineRef.current);
      zonePreviewPolylineRef.current = null;
    }
    zoneVertexMarkersRef.current.forEach((m) => map.removeLayer(m));
    zoneVertexMarkersRef.current = [];
  }, []);

  const finishZone = useCallback(async () => {
    const vertices = zoneVerticesRef.current;
    if (vertices.length < 3) {
      alert("Necesitas al menos 3 puntos para definir una zona");
      return;
    }

    const L = (await import("leaflet")).default;
    const map = mapRef.current as { removeLayer: (l: unknown) => void } | null;
    if (!map) return;

    // Remove preview polyline and vertex markers
    if (zonePreviewPolylineRef.current) {
      map.removeLayer(zonePreviewPolylineRef.current);
      zonePreviewPolylineRef.current = null;
    }
    zoneVertexMarkersRef.current.forEach((m) => map.removeLayer(m));
    zoneVertexMarkersRef.current = [];

    // Draw filled polygon
    const polygon = L.polygon(vertices as [number, number][], {
      color: "#3b82f6",
      fillColor: "#3b82f6",
      fillOpacity: 0.12,
      weight: 2,
      dashArray: "6,4",
    }).addTo(map as unknown as import("leaflet").Map);

    zonePolygonLayerRef.current = polygon;
    setDrawingZone(false);
    setZoneActive(true);
    drawingZoneRef.current = false;
  }, []);

  const clearZone = useCallback(async () => {
    await clearZoneLayers();
    zoneVerticesRef.current = [];
    setZoneVertexCount(0);
    setDrawingZone(false);
    setZoneActive(false);
    drawingZoneRef.current = false;
  }, [clearZoneLayers]);

  const undoLastVertex = useCallback(async () => {
    const vertices = zoneVerticesRef.current;
    if (vertices.length === 0) return;
    vertices.pop();
    setZoneVertexCount(vertices.length);
    // Remove last vertex marker
    const map = mapRef.current as { removeLayer: (l: unknown) => void } | null;
    if (!map) return;
    const last = zoneVertexMarkersRef.current.pop();
    if (last) map.removeLayer(last);
    // Redraw preview polyline
    const L = (await import("leaflet")).default;
    if (zonePreviewPolylineRef.current) {
      map.removeLayer(zonePreviewPolylineRef.current);
      zonePreviewPolylineRef.current = null;
    }
    if (vertices.length >= 2) {
      const line = L.polyline(vertices as [number, number][], {
        color: "#3b82f6", weight: 2, dashArray: "5,5",
      }).addTo(map as unknown as import("leaflet").Map);
      zonePreviewPolylineRef.current = line;
    }
  }, []);

  // ---------- Geolocation ----------
  const geolocate = useCallback(() => {
    // iOS Safari blocks geolocation over HTTP on non-localhost origins → focus search instead
    const needsHttps = window.location.protocol !== "https:" && window.location.hostname !== "localhost";
    if (needsHttps || !navigator.geolocation) {
      searchInputRef.current?.focus();
      searchInputRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      setError("Geolocalización no disponible (HTTP). Busca tu ubicación en el campo de arriba.");
      return;
    }
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
        if (markerRef.current) map.removeLayer(markerRef.current);
        const icon = L.divIcon({
          html: `<div style="background:#f97316;border:3px solid white;border-radius:50%;width:20px;height:20px;box-shadow:0 2px 8px rgba(0,0,0,0.4)"></div>`,
          iconSize: [20, 20], iconAnchor: [10, 10], className: "",
        });
        markerRef.current = L.marker([lat, lng], { icon }).addTo(map as unknown as import("leaflet").Map);
      },
      () => {
        setLocating(false);
        setError("No se pudo obtener tu ubicación. Usa el buscador.");
      }
    );
  }, []);

  // ---------- Search ----------
  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setSearchResults([]);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    if (!value.trim() || value.length < 3) return;

    searchTimeoutRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(value)}&limit=5`,
          { headers: { "Accept-Language": "es" } }
        );
        setSearchResults(await res.json());
      } catch { /* silencioso */ }
      finally { setSearching(false); }
    }, 500);
  };

  const selectSearchResult = useCallback(async (result: NominatimResult) => {
    const lat = parseFloat(result.lat);
    const lng = parseFloat(result.lon);
    setStartPoint({ lat, lng });
    setSearchQuery(result.display_name.split(",").slice(0, 2).join(", "));
    setSearchResults([]);

    const L = (await import("leaflet")).default;
    const map = mapRef.current as { setView: (ll: [number, number], z: number) => void; removeLayer: (l: unknown) => void } | null;
    if (!map) return;
    map.setView([lat, lng], 15);
    if (markerRef.current) map.removeLayer(markerRef.current);
    const icon = L.divIcon({
      html: `<div style="background:#f97316;border:3px solid white;border-radius:50%;width:20px;height:20px;box-shadow:0 2px 8px rgba(0,0,0,0.4)"></div>`,
      iconSize: [20, 20], iconAnchor: [10, 10], className: "",
    });
    markerRef.current = L.marker([lat, lng], { icon }).addTo(map as unknown as import("leaflet").Map);
  }, []);

  // ---------- Generate with AI ----------
  const generateWithAI = useCallback(async () => {
    if (!startPoint) return;
    setLoading(true);
    setLoadingAiParams(true);
    setError(null);
    setRoute(null);
    setAiRecommendation(null);
    setSaved(false);
    setAiParams(null);

    try {
      // 1. Pedir parámetros a la IA
      const paramsRes = await fetch("/api/routes/ai-params", { method: "POST" });
      if (!paramsRes.ok) throw new Error("No se pudo consultar al coach IA");
      const params: AIRouteParams = await paramsRes.json();
      setAiParams(params);
      setLoadingAiParams(false);

      // 2. Generar ruta con los parámetros de la IA
      const res = await fetch("/api/routes/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lat: startPoint.lat,
          lng: startPoint.lng,
          distanceKm: params.distanceKm,
          preference: ["tempo", "intervals"].includes(params.sessionType) ? "shortest" : "recommended",
          avoidFeatures: [],
          maxElevationGainM: params.maxElevationM,
          boundingPolygon: zoneActive && zoneVerticesRef.current.length >= 3
            ? zoneVerticesRef.current
            : undefined,
          askAI: false,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error generando ruta");
      setRoute(data.route);
      setAiRecommendation(params.reasoning);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
      setLoadingAiParams(false);
    } finally {
      setLoading(false);
    }
  }, [startPoint, zoneActive]);

  // ---------- Generate route ----------
  const generate = useCallback(async () => {
    if (!startPoint) return;
    setLoading(true);
    setError(null);
    setRoute(null);
    setAiRecommendation(null);
    setSaved(false);

    const avoidFeatures = [
      ...(avoidSteps ? ["steps"] : []),
      ...(avoidFerries ? ["ferries"] : []),
      ...(avoidFords ? ["fords"] : []),
    ];

    try {
      const res = await fetch("/api/routes/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lat: startPoint.lat,
          lng: startPoint.lng,
          distanceKm,
          preference,
          avoidFeatures,
          maxElevationGainM: limitElevation ? maxElevationGainM : undefined,
          boundingPolygon: zoneActive && zoneVerticesRef.current.length >= 3
            ? zoneVerticesRef.current
            : undefined,
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
  }, [startPoint, distanceKm, preference, avoidSteps, avoidFerries, avoidFords, limitElevation, maxElevationGainM, zoneActive]);

  const reset = () => {
    setRoute(null);
    setAiRecommendation(null);
    setError(null);
    setSaved(false);
    stopTracking();
    const map = mapRef.current as { removeLayer: (l: unknown) => void } | null;
    if (map) {
      if (routeLayerRef.current) { map.removeLayer(routeLayerRef.current); routeLayerRef.current = null; }
      routeExtrasRef.current.forEach((l) => map.removeLayer(l));
      routeExtrasRef.current = [];
    }
  };

  // ─── Abrir ruta en Google Maps ───
  // Muestreo por distancia real: 1 punto cada intervalM metros de la polyline de ORS.
  // Así los waypoints cubren toda la ruta uniformemente y Google Maps no puede atajar.
  const downloadGPX = useCallback(() => {
    if (!route?.geometry) return;
    const pts = route.geometry;
    const now = new Date().toISOString();
    const trkpts = pts.map(([lat, lng]) =>
      `      <trkpt lat="${lat.toFixed(6)}" lon="${lng.toFixed(6)}"></trkpt>`
    ).join("\n");
    const gpx = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="RunCoach" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata><time>${now}</time></metadata>
  <trk>
    <name>Ruta ${route.distanceKm} km</name>
    <trkseg>
${trkpts}
    </trkseg>
  </trk>
</gpx>`;
    const blob = new Blob([gpx], { type: "application/gpx+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ruta-${route.distanceKm}km.gpx`;
    a.click();
    URL.revokeObjectURL(url);
  }, [route]);

  const openInGoogleMaps = useCallback(() => {
    if (!route?.geometry || !startPoint) return;
    const pts = route.geometry;
    if (pts.length < 2) return;

    const haversineM = (a: [number,number], b: [number,number]) => {
      const dLat = (b[0]-a[0]) * Math.PI / 180;
      const dLng = (b[1]-a[1]) * Math.PI / 180;
      const s = Math.sin(dLat/2)**2 +
        Math.cos(a[0]*Math.PI/180) * Math.cos(b[0]*Math.PI/180) * Math.sin(dLng/2)**2;
      return 6371000 * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1-s));
    };

    // Calcular longitud total
    let totalM = 0;
    for (let i = 1; i < pts.length; i++) totalM += haversineM(pts[i-1], pts[i]);

    // Queremos máx 23 waypoints intermedios (Google Maps soporta hasta 25 puntos total)
    // Intervalo adaptativo: distancia / nº de waypoints deseados
    const maxWp = 23;
    const intervalM = Math.max(150, totalM / (maxWp + 1));

    // Muestreo por distancia acumulada — interpola el punto exacto
    const waypoints: string[] = [];
    let cumM = 0;
    let nextM = intervalM;

    for (let i = 1; i < pts.length && waypoints.length < maxWp; i++) {
      const segM = haversineM(pts[i-1], pts[i]);
      // Puede que en un segmento corto caigan varios intervalos
      while (cumM + segM >= nextM && waypoints.length < maxWp) {
        const frac = (nextM - cumM) / segM;
        const lat = pts[i-1][0] + frac * (pts[i][0] - pts[i-1][0]);
        const lng = pts[i-1][1] + frac * (pts[i][1] - pts[i-1][1]);
        waypoints.push(`${lat.toFixed(6)},${lng.toFixed(6)}`);
        nextM += intervalM;
      }
      cumM += segM;
    }

    const origin = `${pts[0][0].toFixed(6)},${pts[0][1].toFixed(6)}`;
    // Para rutas circulares (loop), destino = origen. Así Google Maps cierra el bucle.
    const lastPt = pts[pts.length - 1];
    const closesDist = haversineM(pts[0], lastPt);
    const dest = closesDist < 200
      ? origin  // loop: vuelve al inicio
      : `${lastPt[0].toFixed(6)},${lastPt[1].toFixed(6)}`;

    const wpParam = waypoints.length > 0
      ? `&waypoints=${encodeURIComponent(waypoints.join("|"))}`
      : "";
    const url = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${dest}${wpParam}&travelmode=walking`;
    window.open(url, "_blank");
  }, [route, startPoint]);

  // ─── GPS tracking: seguir la ruta en tiempo real ───
  const startTracking = useCallback(async () => {
    if (!mapRef.current) return;
    const needsHttps = window.location.protocol !== "https:" && window.location.hostname !== "localhost";
    if (needsHttps || !navigator.geolocation) {
      setError("GPS no disponible en HTTP. Usa HTTPS o localhost.");
      return;
    }
    const L = (await import("leaflet")).default;
    const lMap = mapRef.current as unknown as import("leaflet").Map;
    setTracking(true);

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        if (userMarkerRef.current) {
          (userMarkerRef.current as { setLatLng: (ll: [number,number]) => void }).setLatLng([lat, lng]);
        } else {
          const icon = L.divIcon({
            html: `<div style="width:18px;height:18px;background:#3b82f6;border:3px solid white;border-radius:50%;box-shadow:0 0 0 6px rgba(59,130,246,0.3),0 2px 6px rgba(0,0,0,0.4);"></div>`,
            iconSize: [18, 18], iconAnchor: [9, 9], className: "",
          });
          userMarkerRef.current = L.marker([lat, lng], { icon, zIndexOffset: 1000 }).addTo(lMap);
        }
        lMap.panTo([lat, lng], { animate: true });
      },
      (err) => { console.error("GPS:", err); setError("No se pudo obtener tu posición GPS."); },
      { enableHighAccuracy: true, maximumAge: 3000, timeout: 10000 }
    );
  }, []);

  const stopTracking = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    const map = mapRef.current as { removeLayer: (l: unknown) => void } | null;
    if (map && userMarkerRef.current) { map.removeLayer(userMarkerRef.current); userMarkerRef.current = null; }
    setTracking(false);
  }, []);

  // ─── Guardar ruta en BD ───
  const saveRoute = useCallback(async () => {
    if (!route || !startPoint || saving) return;
    setSaving(true);
    try {
      const res = await fetch("/api/routes/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          distanceKm: route.distanceKm,
          durationMin: route.durationMin,
          elevationM: route.elevationM,
          elevationLossM: route.elevationLossM,
          geometry: route.geometry,
          startLat: startPoint.lat,
          startLng: startPoint.lng,
        }),
      });
      if (res.ok) setSaved(true);
    } catch { /* silencioso */ }
    finally { setSaving(false); }
  }, [route, startPoint, saving]);

  return (
    <div className="flex flex-col lg:flex-row gap-4 lg:h-[calc(100vh-10rem)]">

      {/* ── Panel lateral — encima en móvil, izquierda en desktop ── */}
      <div className="w-full lg:w-80 lg:shrink-0 lg:overflow-y-auto lg:space-y-3 lg:pb-2">
      <div className="space-y-3">

        {/* 1. Punto de salida */}
        <Section title="Punto de salida" icon={<MapPin className="h-4 w-4 text-orange-400" />}>
          {/* Buscador */}
          <div className="relative">
            <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-background/50 px-3 py-2 focus-within:border-orange-500/50 transition-colors">
              {searching
                ? <Loader2 className="h-4 w-4 text-muted-foreground animate-spin shrink-0" />
                : <Search className="h-4 w-4 text-muted-foreground shrink-0" />}
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                placeholder="Buscar ciudad, calle..."
                className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/60"
              />
              {searchQuery && (
                <button onClick={() => { setSearchQuery(""); setSearchResults([]); }}>
                  <X className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
                </button>
              )}
            </div>
            {searchResults.length > 0 && (
              <div className="absolute z-50 top-full mt-1 w-full rounded-lg border border-border/60 bg-card shadow-lg overflow-hidden">
                {searchResults.map((r) => (
                  <button
                    key={r.place_id}
                    onClick={() => selectSearchResult(r)}
                    className="w-full text-left px-3 py-2 text-xs hover:bg-muted/60 transition-colors border-b border-border/30 last:border-0 leading-snug"
                  >
                    <span className="text-orange-400 mr-1.5">📍</span>
                    {r.display_name}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <div className="h-px flex-1 bg-border/40" />
            <span className="text-xs text-muted-foreground/60">o</span>
            <div className="h-px flex-1 bg-border/40" />
          </div>

          <button
            onClick={geolocate}
            disabled={locating}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-border/60 text-sm hover:bg-muted/40 active:scale-95 transition-all disabled:opacity-50"
          >
            {locating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Navigation className="h-4 w-4 text-orange-400" />}
            {locating ? "Obteniendo ubicación…" : "Usar mi ubicación"}
          </button>

          {startPoint ? (
            <p className="text-xs text-green-400 flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              {startPoint.lat.toFixed(5)}, {startPoint.lng.toFixed(5)}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">O haz clic directamente en el mapa</p>
          )}
        </Section>

        {/* 2. Zona de carrera */}
        <Section title="Zona de carrera" icon={<PenLine className="h-4 w-4 text-blue-400" />} defaultOpen={true}>
          {!drawingZone && !zoneActive && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground leading-relaxed">
                Define el área donde quieres correr. La ruta se generará dentro de esa zona.
              </p>
              <button
                onClick={startDrawingZone}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-blue-500/40 text-blue-400 text-sm hover:bg-blue-500/10 transition-colors"
              >
                <PenLine className="h-4 w-4" />
                Dibujar zona en el mapa
              </button>
            </div>
          )}

          {drawingZone && (
            <div className="space-y-2">
              <div className="rounded-lg bg-blue-500/10 border border-blue-500/30 px-3 py-2">
                <p className="text-xs text-blue-400 font-medium">Modo dibujo activo</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Haz clic en el mapa para añadir vértices · {zoneVertexCount} puntos
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={finishZone}
                  disabled={zoneVertexCount < 3}
                  className="flex-1 px-3 py-2 rounded-lg bg-blue-500 text-white text-xs font-medium hover:bg-blue-600 disabled:opacity-40 transition-colors"
                >
                  Cerrar ({zoneVertexCount} pts)
                </button>
                <button
                  onClick={undoLastVertex}
                  disabled={zoneVertexCount === 0}
                  title="Deshacer último punto"
                  className="px-3 py-2 rounded-lg border border-border/60 text-muted-foreground text-xs hover:bg-muted/40 transition-colors disabled:opacity-30"
                >
                  ↩
                </button>
                <button
                  onClick={clearZone}
                  className="px-3 py-2 rounded-lg border border-border/60 text-muted-foreground text-xs hover:bg-muted/40 transition-colors"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )}

          {zoneActive && (
            <div className="space-y-2">
              <div className="rounded-lg bg-green-500/10 border border-green-500/30 px-3 py-2 flex items-center justify-between">
                <div>
                  <p className="text-xs text-green-400 font-medium">✓ Zona activa</p>
                  <p className="text-xs text-muted-foreground">{zoneVerticesRef.current.length} vértices</p>
                </div>
                <button
                  onClick={clearZone}
                  className="text-muted-foreground hover:text-destructive transition-colors"
                  title="Eliminar zona"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <button
                onClick={startDrawingZone}
                className="w-full text-xs px-3 py-1.5 rounded-lg border border-border/50 text-muted-foreground hover:bg-muted/40 transition-colors"
              >
                Redibujar zona
              </button>
            </div>
          )}
        </Section>

        {/* Toggle modo IA / Manual */}
        <div className="rounded-xl border border-border/50 bg-card/40 overflow-hidden">
          <div className="flex">
            <button
              onClick={() => setAiMode(false)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-medium transition-colors ${
                !aiMode ? "bg-orange-500 text-white" : "text-muted-foreground hover:bg-muted/40"
              }`}
            >
              <Activity className="h-3.5 w-3.5" />
              Manual
            </button>
            <button
              onClick={() => setAiMode(true)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-medium transition-colors ${
                aiMode ? "bg-orange-500 text-white" : "text-muted-foreground hover:bg-muted/40"
              }`}
            >
              <Sparkles className="h-3.5 w-3.5" />
              Coach IA
            </button>
          </div>
        </div>

        {/* Modo IA: info de lo que hará */}
        {aiMode && !aiParams && (
          <div className="rounded-xl border border-orange-500/20 bg-orange-500/5 p-4 space-y-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-orange-400">
              <Bot className="h-4 w-4" />
              El coach decide por ti
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Analizará tu TSB, actividades recientes, próximas carreras y objetivos para elegir
              automáticamente distancia, desnivel y tipo de sesión de hoy.
            </p>
            <p className="text-xs text-muted-foreground">
              Solo dibuja una zona (opcional) y pulsa <strong className="text-foreground">Generar con IA</strong>.
            </p>
          </div>
        )}

        {/* Parámetros que decidió la IA */}
        {aiMode && aiParams && (
          <div className="rounded-xl border border-orange-500/30 bg-orange-500/5 p-4 space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-orange-400">
              <Sparkles className="h-4 w-4" />
              Sesión de hoy — según tu estado
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-lg bg-background/40 py-2 px-1">
                <p className="text-base font-bold">{aiParams.distanceKm}</p>
                <p className="text-[10px] text-muted-foreground">km</p>
              </div>
              <div className="rounded-lg bg-background/40 py-2 px-1">
                <p className="text-base font-bold">↑{aiParams.maxElevationM}</p>
                <p className="text-[10px] text-muted-foreground">m D+</p>
              </div>
              <div className="rounded-lg bg-background/40 py-2 px-1">
                <p className="text-base font-bold">{aiParams.intensity}</p>
                <p className="text-[10px] text-muted-foreground">zona</p>
              </div>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className={`font-medium ${SESSION_TYPE_LABELS[aiParams.sessionType]?.color ?? "text-orange-400"}`}>
                {SESSION_TYPE_LABELS[aiParams.sessionType]?.label ?? aiParams.sessionType}
              </span>
              <span className="flex items-center gap-1 text-muted-foreground">
                <Timer className="h-3 w-3" />
                {aiParams.targetPaceMinKm} min/km
              </span>
            </div>
          </div>
        )}

        {/* 3. Distancia — solo en modo manual */}
        {!aiMode && <Section title="Distancia" icon={<TrendingUp className="h-4 w-4 text-orange-400" />}>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Objetivo</span>
              <span className="text-sm font-bold text-orange-400">{distanceKm} km</span>
            </div>
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
        </Section>}

        {/* 4. Desnivel — solo en modo manual */}
        {!aiMode && <Section title="Desnivel" icon={<Mountain className="h-4 w-4 text-orange-400" />}>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={limitElevation}
              onChange={(e) => setLimitElevation(e.target.checked)}
              className="accent-orange-500"
            />
            <span className="text-sm">Limitar desnivel positivo</span>
          </label>
          {limitElevation && (
            <div className="space-y-2 pt-1">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">D+ máximo</span>
                <span className="text-sm font-bold text-orange-400">{maxElevationGainM} m</span>
              </div>
              <input
                type="range" min={50} max={2000} step={50}
                value={maxElevationGainM}
                onChange={(e) => setMaxElevationGainM(parseInt(e.target.value))}
                className="w-full accent-orange-500"
              />
              <div className="flex gap-1">
                {[100, 200, 300, 500, 1000].map((v) => (
                  <button
                    key={v}
                    onClick={() => setMaxElevationGainM(v)}
                    className={`flex-1 py-0.5 rounded text-xs border transition-colors ${maxElevationGainM === v ? "bg-orange-500/20 border-orange-500/50 text-orange-400" : "border-border/50 text-muted-foreground hover:border-border"}`}
                  >
                    {v}
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground/70">
                Si ORS no puede evitar más desnivel, verás un aviso en el resultado.
              </p>
            </div>
          )}
          {!limitElevation && (
            <p className="text-xs text-muted-foreground">Sin límite — usa la zona para controlar el área.</p>
          )}
        </Section>}

        {/* 6. Avanzado — solo en modo manual */}
        {!aiMode && <Section title="Opciones avanzadas" icon={<ChevronDown className="h-4 w-4 text-muted-foreground" />} defaultOpen={false}>
          <div className="space-y-2">
            <label className="text-xs text-muted-foreground">Preferencia de ruta</label>
            <div className="grid grid-cols-2 gap-2">
              {[{ v: "recommended", l: "Recomendada" }, { v: "shortest", l: "Más corta / llana" }].map(({ v, l }) => (
                <button
                  key={v}
                  onClick={() => setPreference(v as "recommended" | "shortest")}
                  className={`py-1.5 rounded-lg text-xs border transition-colors ${preference === v ? "bg-orange-500/20 border-orange-500/50 text-orange-400" : "border-border/50 text-muted-foreground hover:border-border"}`}
                >
                  {l}
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground/70">
              "Más corta" tiende a elegir caminos más llanos y directos.
            </p>
          </div>

          <div className="space-y-1.5 pt-1">
            <label className="text-xs text-muted-foreground">Evitar</label>
            {[
              { state: avoidSteps, set: setAvoidSteps, label: "Escaleras" },
              { state: avoidFerries, set: setAvoidFerries, label: "Transbordadores" },
              { state: avoidFords, set: setAvoidFords, label: "Vados" },
            ].map(({ state, set, label }) => (
              <label key={label} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox" checked={state}
                  onChange={(e) => set(e.target.checked)}
                  className="accent-orange-500"
                />
                <span className="text-sm">{label}</span>
              </label>
            ))}
          </div>
        </Section>}

        {/* Botón generar */}
        {aiMode ? (
          <button
            onClick={generateWithAI}
            disabled={!startPoint || loading || drawingZone}
            className="w-full py-3 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-semibold text-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
          >
            {loadingAiParams
              ? <><Loader2 className="h-4 w-4 animate-spin" /> Consultando coach IA...</>
              : loading
              ? <><Loader2 className="h-4 w-4 animate-spin" /> Generando ruta...</>
              : <><Sparkles className="h-4 w-4" /> Generar con IA</>}
          </button>
        ) : (
          <button
            onClick={generate}
            disabled={!startPoint || loading || drawingZone}
            className="w-full py-3 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-semibold text-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
          >
            {loading
              ? <><Loader2 className="h-4 w-4 animate-spin" /> Generando ruta...</>
              : <><TrendingUp className="h-4 w-4" /> Generar ruta</>}
          </button>
        )}

        {drawingZone && (
          <p className="text-xs text-center text-blue-400">
            Termina de dibujar la zona antes de generar
          </p>
        )}

        {/* Error */}
        {error && (
          <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
            {error}
          </div>
        )}

        {/* Stats de la ruta */}
        {route && (
          <div className="rounded-xl border border-orange-500/30 bg-orange-500/5 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-sm text-orange-400">Ruta generada</h3>
              <button onClick={reset} className="text-muted-foreground hover:text-foreground">
                <RotateCcw className="h-4 w-4" />
              </button>
            </div>

            {/* Botones de acción */}
            <div className="grid grid-cols-2 gap-2">
              {/* Descargar GPX — abre en cualquier app GPS */}
              <button
                onClick={downloadGPX}
                className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-blue-500/10 border border-blue-500/30 text-blue-400 hover:bg-blue-500/20 transition-colors"
              >
                <Download className="h-3.5 w-3.5" />
                Descargar GPX
              </button>
              <button
                onClick={saveRoute}
                disabled={saving || saved}
                className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                  saved
                    ? "bg-green-500/10 border border-green-500/30 text-green-400"
                    : "bg-orange-500/10 border border-orange-500/30 text-orange-400 hover:bg-orange-500/20"
                } disabled:opacity-50`}
              >
                {saved ? (
                  <><Check className="h-3.5 w-3.5" />Guardada</>
                ) : saving ? (
                  <><Loader2 className="h-3.5 w-3.5 animate-spin" />Guardando...</>
                ) : (
                  <><Bookmark className="h-3.5 w-3.5" />Guardar ruta</>
                )}
              </button>
            </div>
            {/* Botones secundarios */}
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={tracking ? stopTracking : startTracking}
                className={`flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-colors ${
                  tracking
                    ? "bg-blue-500/20 border border-blue-500/50 text-blue-300"
                    : "bg-muted/30 border border-border/40 text-muted-foreground hover:bg-muted/50"
                }`}
              >
                <Navigation className={`h-3 w-3 ${tracking ? "animate-pulse" : ""}`} />
                {tracking ? "Parar GPS" : "GPS en app"}
              </button>
              <button
                onClick={openInGoogleMaps}
                className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-muted/30 border border-border/40 text-muted-foreground hover:bg-muted/50 transition-colors"
              >
                <Map className="h-3 w-3" />
                Google Maps
              </button>
            </div>

            {route.elevationExceeded && (
              <div className="rounded-lg bg-yellow-500/10 border border-yellow-500/30 px-3 py-2 space-y-2">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-3.5 w-3.5 text-yellow-400 shrink-0 mt-0.5" />
                  <p className="text-xs text-yellow-400">
                    D+ supera el límite ({maxElevationGainM} m). ORS no encontró ruta más llana.
                  </p>
                </div>
                {!aiMode && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => { setLimitElevation(false); setMaxElevationGainM(9999); }}
                      className="flex-1 px-2 py-1.5 rounded-lg bg-yellow-500/15 text-yellow-400 text-xs font-medium hover:bg-yellow-500/25 transition-colors"
                    >
                      Sin límite D+
                    </button>
                    <button
                      onClick={() => {
                        const newMax = Math.min(maxElevationGainM + 200, 2000);
                        setMaxElevationGainM(newMax);
                      }}
                      className="flex-1 px-2 py-1.5 rounded-lg bg-yellow-500/15 text-yellow-400 text-xs font-medium hover:bg-yellow-500/25 transition-colors"
                    >
                      +200m D+
                    </button>
                  </div>
                )}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 text-center">
              <div className="rounded-lg bg-background/40 py-2">
                <p className="text-lg font-bold">{route.distanceKm}</p>
                <p className="text-xs text-muted-foreground">km</p>
              </div>
              <div className="rounded-lg bg-background/40 py-2">
                <p className="text-lg font-bold flex items-center justify-center gap-0.5">
                  <Clock className="h-4 w-4" />{route.durationMin}
                </p>
                <p className="text-xs text-muted-foreground">min est.</p>
              </div>
              <div className="rounded-lg bg-background/40 py-2">
                <p className="text-lg font-bold text-green-400 flex items-center justify-center gap-0.5">
                  <Mountain className="h-4 w-4" />{route.elevationM}↑
                </p>
                <p className="text-xs text-muted-foreground">m D+</p>
              </div>
              <div className="rounded-lg bg-background/40 py-2">
                <p className="text-lg font-bold text-blue-400 flex items-center justify-center gap-0.5">
                  <ArrowDown className="h-4 w-4" />{route.elevationLossM ?? "—"}↓
                </p>
                <p className="text-xs text-muted-foreground">m D-</p>
              </div>
            </div>
          </div>
        )}

        {/* Coach AI */}
        {aiRecommendation && (
          <div className="rounded-xl border border-orange-500/20 bg-orange-500/5 p-4 space-y-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-orange-400">
              <Bot className="h-4 w-4" />
              {aiMode ? "Por qué esta sesión" : "Coach AI dice:"}
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">{aiRecommendation}</p>
          </div>
        )}

      </div>{/* end inner space-y-3 */}
      </div>{/* end sidebar */}

      {/* ── Mapa ── */}
      <div className="rounded-xl overflow-hidden border border-border/50 relative h-[60vh] lg:flex-1 lg:h-auto">
        <div ref={mapContainerRef} className="w-full h-full" />

        {drawingZone && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[1000] pointer-events-none">
            <div className="bg-blue-500/90 backdrop-blur-sm text-white text-xs px-4 py-2 rounded-full shadow-lg">
              ✏️ Toca para añadir vértices · botón cerrar para terminar
            </div>
          </div>
        )}

        {!startPoint && !drawingZone && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="bg-background/80 backdrop-blur-sm rounded-xl px-4 py-3 text-sm text-muted-foreground border border-border/50 text-center">
              <MapPin className="h-5 w-5 mx-auto mb-1 text-orange-400" />
              Busca una ubicación o toca el mapa
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
