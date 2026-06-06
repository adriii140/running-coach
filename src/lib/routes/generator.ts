// Generador de rutas usando OpenRouteService (gratuito)
// https://openrouteservice.org/dev/#/api-docs

export interface RouteGeneratorParams {
  startLat: number;
  startLng: number;
  distanceKm: number;
  routeType: "loop" | "outback"; // loop = circular, outback = ida y vuelta
  surface: "asphalt" | "trail" | "mixed";
}

export interface GeneratedRouteData {
  geometry: [number, number][];   // [lng, lat] pairs
  distanceKm: number;
  elevationM: number;
  durationMin: number;
  waypoints: [number, number][];
}

// Genera waypoints en círculo para crear una ruta circular
function generateLoopWaypoints(
  lat: number,
  lng: number,
  radiusKm: number,
  numPoints: number = 4
): [number, number][] {
  const waypoints: [number, number][] = [];
  // Desplazar ligeramente el inicio para que ORS no corte la ruta
  const startAngle = Math.random() * 360;

  for (let i = 0; i < numPoints; i++) {
    const angle = ((startAngle + (360 / numPoints) * i) * Math.PI) / 180;
    // 1° lat ≈ 111 km, 1° lng ≈ 111 * cos(lat) km
    const dlat = (radiusKm * Math.cos(angle)) / 111;
    const dlng = (radiusKm * Math.sin(angle)) / (111 * Math.cos((lat * Math.PI) / 180));
    waypoints.push([lat + dlat, lng + dlng]);
  }

  return waypoints;
}

export async function generateRoute(params: RouteGeneratorParams): Promise<GeneratedRouteData> {
  const apiKey = process.env.OPENROUTESERVICE_API_KEY;
  if (!apiKey) throw new Error("OPENROUTESERVICE_API_KEY no configurada");

  const { startLat, startLng, distanceKm, routeType, surface } = params;

  // Radio para ruta circular: C = 2πr → r = C/2π
  const radiusKm = distanceKm / (2 * Math.PI);

  const profile =
    surface === "trail" ? "foot-hiking" :
    surface === "mixed" ? "foot-hiking" :
    "foot-walking"; // foot-running no está en tier gratuito

  let coordinates: [number, number][];

  if (routeType === "loop") {
    const waypoints = generateLoopWaypoints(startLat, startLng, radiusKm, 4);
    coordinates = [
      [startLng, startLat],
      ...waypoints.map(([lat, lng]) => [lng, lat] as [number, number]),
      [startLng, startLat], // volver al inicio
    ];
  } else {
    // Ida y vuelta: punto final en dirección norte a distancia/2
    const halfKm = distanceKm / 2;
    const endLat = startLat + halfKm / 111;
    coordinates = [
      [startLng, startLat],
      [startLng, endLat],
      [startLng, startLat],
    ];
  }

  const body = {
    coordinates,
    instructions: false,
    elevation: true,
    units: "km",
  };

  const res = await fetch(
    `https://api.openrouteservice.org/v2/directions/${profile}/geojson`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: apiKey,
      },
      body: JSON.stringify(body),
    }
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`ORS error ${res.status}: ${text}`);
  }

  const data = await res.json();
  const feature = data.features?.[0];
  if (!feature) throw new Error("ORS no devolvió ninguna ruta");

  const geometry: [number, number][] = feature.geometry.coordinates.map(
    ([lng, lat]: [number, number]) => [lat, lng]
  );

  const summary = feature.properties?.summary;
  const distanceKmActual = summary?.distance ?? distanceKm;
  const durationMin = Math.round((summary?.duration ?? distanceKm * 6 * 60) / 60);

  // Calcular desnivel positivo
  let elevationM = 0;
  const coords3d: [number, number, number][] = feature.geometry.coordinates;
  if (coords3d.length > 1 && coords3d[0].length >= 3) {
    for (let i = 1; i < coords3d.length; i++) {
      const diff = coords3d[i][2] - coords3d[i - 1][2];
      if (diff > 0) elevationM += diff;
    }
  }

  return {
    geometry,
    distanceKm: Math.round(distanceKmActual * 10) / 10,
    elevationM: Math.round(elevationM),
    durationMin,
    waypoints: coordinates.map(([lng, lat]) => [lat, lng]),
  };
}
