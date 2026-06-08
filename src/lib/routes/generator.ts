// Generador de rutas usando OpenRouteService (gratuito)
// Estrategia: genera N rutas en paralelo con seeds distintos, elige la más cercana al objetivo
// Luego recorta si excede el margen permitido (+200m)

export interface RouteGeneratorParams {
  startLat: number;
  startLng: number;
  distanceKm: number;
  preference?: "recommended" | "shortest";
  avoidFeatures?: string[];
  maxElevationGainM?: number;
  boundingPolygon?: [number, number][];
  seed?: number; // si se pasa, usa ese seed fijo (para reproducibilidad)
}

export interface GeneratedRouteData {
  geometry: [number, number][];
  distanceKm: number;
  elevationM: number;
  elevationLossM: number;
  durationMin: number;
  waypoints: [number, number][];
  steps: never[];
  elevationExceeded?: boolean;
}

// ── Haversine distance in km ──
function distKm(a: [number, number], b: [number, number]): number {
  const R = 6371;
  const dLat = ((b[0] - a[0]) * Math.PI) / 180;
  const dLng = ((b[1] - a[1]) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a[0] * Math.PI) / 180) *
      Math.cos((b[0] * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

/** Recalcular distancia real de una geometría */
function calcDistKm(geometry: [number, number][]): number {
  let d = 0;
  for (let i = 1; i < geometry.length; i++) d += distKm(geometry[i - 1], geometry[i]);
  return d;
}

/** Calcular D+ de una geometría con elevación */
function calcElevationGain(coords: [number, number, number][]): number {
  let gain = 0;
  for (let i = 1; i < coords.length; i++) {
    const diff = coords[i][2] - coords[i - 1][2];
    if (diff > 0) gain += diff;
  }
  return gain;
}

/** Recortar la geometría a exactamente targetKm interpolando el último punto */
function clipToDistance(geometry: [number, number][], targetKm: number): [number, number][] {
  let cumKm = 0;
  const clipped: [number, number][] = [geometry[0]];
  for (let i = 1; i < geometry.length; i++) {
    const segKm = distKm(geometry[i - 1], geometry[i]);
    if (cumKm + segKm >= targetKm) {
      const frac = (targetKm - cumKm) / segKm;
      const lat = geometry[i - 1][0] + frac * (geometry[i][0] - geometry[i - 1][0]);
      const lng = geometry[i - 1][1] + frac * (geometry[i][1] - geometry[i - 1][1]);
      clipped.push([lat, lng]);
      return clipped;
    }
    cumKm += segKm;
    clipped.push(geometry[i]);
  }
  return clipped;
}

function isInPolygon(lat: number, lng: number, poly: [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [li, loi] = poly[i], [lj, loj] = poly[j];
    if ((loi > lng) !== (loj > lng) && lat < ((lj - li) * (lng - loi)) / (loj - loi) + li)
      inside = !inside;
  }
  return inside;
}

/** Waypoint en dirección angleDeg a radiusKm del origen, garantizando que esté dentro del polígono */
function waypointAt(
  lat: number, lng: number, angleDeg: number, radiusKm: number,
  polygon?: [number, number][]
): [number, number] {
  const cosLat = Math.cos((lat * Math.PI) / 180);
  for (let a = 0; a < 10; a++) {
    const r = radiusKm * (1 - a * 0.08);
    const rad = (angleDeg * Math.PI) / 180;
    const pLat = lat + (r * Math.cos(rad)) / 111;
    const pLng = lng + (r * Math.sin(rad)) / (111 * cosLat);
    if (!polygon || isInPolygon(pLat, pLng, polygon)) return [pLat, pLng];
  }
  return [lat, lng];
}

/** Exportar para uso en componentes */
export function sampleGeometry(geometry: [number, number][], targetCount: number): [number, number][] {
  if (geometry.length <= targetCount) return geometry;
  const step = (geometry.length - 1) / (targetCount - 1);
  return Array.from({ length: targetCount }, (_, i) => geometry[Math.round(i * step)]);
}

// ── ORS API call ──
async function callORS(profile: string, body: Record<string, unknown>, apiKey: string) {
  return fetch(
    `https://api.openrouteservice.org/v2/directions/${profile}/geojson`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: apiKey },
      body: JSON.stringify(body),
    }
  );
}

interface CandidateRoute {
  geometry: [number, number][];
  raw3d: [number, number, number][];
  distKm: number;
  elevationM: number;
  elevationLossM: number;
  durationMin: number;
}

/** Llamar a ORS round_trip con un seed concreto y parsear la respuesta */
async function fetchCandidate(
  startLat: number,
  startLng: number,
  targetM: number,
  numPoints: number,
  seed: number,
  profile: string,
  preference: string,
  optionsBase: Record<string, unknown>,
  apiKey: string
): Promise<CandidateRoute | null> {
  const body = {
    coordinates: [[startLng, startLat]],
    options: {
      ...optionsBase,
      round_trip: { length: targetM, points: numPoints, seed },
    },
    instructions: false,
    elevation: true,
    units: "km",
    preference,
  };

  try {
    const res = await callORS(profile, body, apiKey);
    if (!res.ok) return null;
    const data = await res.json();
    const feature = (data.features as unknown[])?.[0] as Record<string, unknown> | undefined;
    if (!feature) return null;

    const raw3d = (feature.geometry as { coordinates: [number, number, number][] }).coordinates;
    const geometry: [number, number][] = raw3d.map(([lng, lat]) => [lat, lng]);
    const summary = (feature.properties as { summary?: { distance: number; duration: number } })?.summary;

    let elevationM = 0;
    let elevationLossM = 0;
    if (raw3d.length > 1 && raw3d[0].length >= 3) {
      for (let i = 1; i < raw3d.length; i++) {
        const diff = raw3d[i][2] - raw3d[i - 1][2];
        if (diff > 0) elevationM += diff;
        else elevationLossM += Math.abs(diff);
      }
    }

    return {
      geometry,
      raw3d,
      distKm: calcDistKm(geometry),
      elevationM: Math.round(elevationM),
      elevationLossM: Math.round(elevationLossM),
      durationMin: Math.round((summary?.duration ?? (calcDistKm(geometry) * 6 * 60)) / 60),
    };
  } catch {
    return null;
  }
}

// ──────────────────────────────────────────────────────────
//  MAIN EXPORT
// ──────────────────────────────────────────────────────────

export async function generateRoute(params: RouteGeneratorParams): Promise<GeneratedRouteData> {
  const apiKey = process.env.OPENROUTESERVICE_API_KEY;
  if (!apiKey) throw new Error("OPENROUTESERVICE_API_KEY no configurada");

  const {
    startLat, startLng, distanceKm,
    preference = "recommended",
    avoidFeatures = [],
    maxElevationGainM,
    boundingPolygon,
    seed: fixedSeed,
  } = params;

  // foot-hiking es más permisivo: acepta senderos, caminos, trails → siempre usarlo
  const profile = "foot-hiking";
  const validAvoid = avoidFeatures.filter((f) => ["steps", "ferries", "fords"].includes(f));
  const targetM = Math.round(distanceKm * 1000);
  const toleranceKm = 0.2; // ±200m máximo de margen
  const maxAllowedKm = distanceKm + toleranceKm;

  // Más puntos intermedios = ruta más circular y con distancia más precisa
  const numPoints = distanceKm <= 3 ? 3 : distanceKm <= 7 ? 4 : distanceKm <= 15 ? 5 : 6;

  const optionsBase: Record<string, unknown> = {};
  if (validAvoid.length > 0) optionsBase.avoid_features = validAvoid;

  // ── Con polígono: waypoints manuales dentro de la zona ──
  if (boundingPolygon && boundingPolygon.length >= 3) {
    const streetFactor = 0.72;
    const radiusKm = (distanceKm * streetFactor) / (2 * Math.PI);
    const angles = [0, 60, 120, 180, 240, 300]; // 6 ángulos para ruta más variada
    const wps = angles.map(a => waypointAt(startLat, startLng, a, radiusKm, boundingPolygon));
    // Usar 3-4 waypoints distribuidos dentro de la zona
    const nWp = distanceKm <= 5 ? 3 : 4;
    const step = Math.floor(angles.length / nWp);
    const selected = Array.from({ length: nWp }, (_, i) => wps[i * step]);
    const coordinates: [number, number][] = [
      [startLng, startLat],
      ...selected.map(([lt, ln]): [number, number] => [ln, lt]),
      [startLng, startLat],
    ];
    const body = {
      coordinates,
      options: Object.keys(optionsBase).length > 0 ? optionsBase : undefined,
      instructions: false,
      elevation: true,
      units: "km",
      preference,
    };
    const res = await callORS(profile, body, apiKey);
    if (!res.ok) throw new Error(`ORS error generando ruta en zona: ${res.status}`);
    const data = await res.json();
    const feature = (data.features as unknown[])?.[0] as Record<string, unknown> | undefined;
    if (!feature) throw new Error("ORS no devolvió ruta para la zona dibujada.");
    const raw3d = (feature.geometry as { coordinates: [number, number, number][] }).coordinates;
    let geometry: [number, number][] = raw3d.map(([lng2, lat2]) => [lat2, lng2]);
    const summary = (feature.properties as { summary?: { distance: number; duration: number } })?.summary;
    let elevationM = 0, elevationLossM = 0;
    for (let i = 1; i < raw3d.length; i++) {
      const diff = raw3d[i][2] - raw3d[i - 1][2];
      if (diff > 0) elevationM += diff; else elevationLossM += Math.abs(diff);
    }
    if (calcDistKm(geometry) > maxAllowedKm) geometry = clipToDistance(geometry, maxAllowedKm);
    const finalDist = Math.round(calcDistKm(geometry) * 10) / 10;
    return {
      geometry, distanceKm: finalDist,
      elevationM: Math.round(elevationM), elevationLossM: Math.round(elevationLossM),
      durationMin: Math.round((summary?.duration ?? finalDist * 6 * 60) / 60),
      waypoints: [geometry[0], geometry[geometry.length - 1]],
      steps: [],
      elevationExceeded: maxElevationGainM !== undefined && elevationM > maxElevationGainM,
    };
  }

  // ── Generar 5 candidatos en paralelo con seeds distintos ──
  // Si hay seed fijo (reproducibilidad), usar 5 seeds consecutivos desde ese
  const baseSeed = fixedSeed ?? Math.floor(Math.random() * 40) + 1;
  const seeds = [baseSeed, baseSeed + 7, baseSeed + 13, baseSeed + 23, baseSeed + 31].map(s => ((s - 1) % 89) + 1);

  const candidates = await Promise.all(
    seeds.map(s =>
      fetchCandidate(startLat, startLng, targetM, numPoints, s, profile, preference, optionsBase, apiKey)
    )
  );

  const valid = candidates.filter((c): c is CandidateRoute => c !== null);
  if (valid.length === 0) throw new Error("ORS no pudo generar ninguna ruta. Prueba con otro punto de inicio.");

  // ── Selección del mejor candidato ──
  // 1. Filtrar por elevación si hay límite
  // 2. De los que quedan, elegir el más cercano a la distancia objetivo
  let pool = maxElevationGainM
    ? valid.filter(c => c.elevationM <= maxElevationGainM + 20) // tolerancia 20m en elevación
    : valid;

  if (pool.length === 0) {
    // Ninguno cumple el límite → tomar el de menos D+ y marcar como excedido
    pool = [...valid].sort((a, b) => a.elevationM - b.elevationM).slice(0, 1);
  }


  // Elegir el más cercano a la distancia objetivo (en valor absoluto)
  const best = pool.reduce((prev, curr) =>
    Math.abs(curr.distKm - distanceKm) < Math.abs(prev.distKm - distanceKm) ? curr : prev
  );

  // ── Recortar si excede el máximo permitido ──
  let geometry = best.geometry;
  if (best.distKm > maxAllowedKm) {
    geometry = clipToDistance(geometry, maxAllowedKm);
  }

  // Recalcular distancia real final
  const finalDistKm = Math.round(calcDistKm(geometry) * 10) / 10;

  // Recalcular elevación sobre la geometría recortada si fue recortada
  let finalElevationM = best.elevationM;
  let finalElevationLossM = best.elevationLossM;
  if (geometry.length < best.geometry.length) {
    // Recalcular D+ sobre el tramo recortado
    const ratio = geometry.length / best.geometry.length;
    finalElevationM = Math.round(best.elevationM * ratio);
    finalElevationLossM = Math.round(best.elevationLossM * ratio);
  }

  return {
    geometry,
    distanceKm: finalDistKm,
    elevationM: finalElevationM,
    elevationLossM: finalElevationLossM,
    durationMin: best.durationMin,
    waypoints: [geometry[0], geometry[geometry.length - 1]],
    steps: [],
    elevationExceeded: maxElevationGainM !== undefined && finalElevationM > maxElevationGainM,
  };
}
