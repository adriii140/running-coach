import type { StravaActivity, StravaActivityStreams, StravaLap, StravaTokenResponse } from "@/types/strava.types";

const STRAVA_API = "https://www.strava.com/api/v3";
const STRAVA_AUTH = "https://www.strava.com/oauth";

// Pausa entre peticiones para respetar el rate limit (100 req/15min)
const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function refreshStravaToken(refreshToken: string): Promise<StravaTokenResponse> {
  const res = await fetch(`${STRAVA_AUTH}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: process.env.STRAVA_CLIENT_ID,
      client_secret: process.env.STRAVA_CLIENT_SECRET,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });

  if (!res.ok) {
    throw new Error(`Strava token refresh failed: ${res.status}`);
  }

  return res.json();
}

export async function getStravaActivities(
  accessToken: string,
  options: { page?: number; perPage?: number; after?: number; before?: number } = {}
): Promise<StravaActivity[]> {
  const params = new URLSearchParams({
    page: String(options.page ?? 1),
    per_page: String(options.perPage ?? 50),
    ...(options.after ? { after: String(options.after) } : {}),
    ...(options.before ? { before: String(options.before) } : {}),
  });

  const res = await fetch(`${STRAVA_API}/athlete/activities?${params}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (res.status === 429) {
    throw new Error("RATE_LIMIT");
  }

  if (!res.ok) {
    throw new Error(`Strava activities error: ${res.status}`);
  }

  return res.json();
}

export async function getStravaActivity(
  accessToken: string,
  activityId: number
): Promise<StravaActivity> {
  const res = await fetch(`${STRAVA_API}/activities/${activityId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    throw new Error(`Strava activity ${activityId} error: ${res.status}`);
  }

  return res.json();
}

export async function getStravaActivityStreams(
  accessToken: string,
  activityId: number
): Promise<StravaActivityStreams> {
  const keys = "time,distance,heartrate,altitude,velocity_smooth,cadence,latlng";
  const res = await fetch(
    `${STRAVA_API}/activities/${activityId}/streams?keys=${keys}&key_by_type=true`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (!res.ok) {
    return {};
  }

  return res.json();
}

export async function getStravaActivityLaps(
  accessToken: string,
  activityId: number
): Promise<StravaLap[]> {
  const res = await fetch(`${STRAVA_API}/activities/${activityId}/laps`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    return [];
  }

  return res.json();
}

// Sincronización completa paginada con manejo de rate limit
export async function fetchAllStravaActivities(
  accessToken: string,
  options: { after?: number; onProgress?: (count: number) => void } = {}
): Promise<StravaActivity[]> {
  const all: StravaActivity[] = [];
  let page = 1;

  while (true) {
    const batch = await getStravaActivities(accessToken, {
      page,
      perPage: 50,
      after: options.after,
    });

    if (batch.length === 0) break;

    all.push(...batch);
    options.onProgress?.(all.length);

    if (batch.length < 50) break;

    page++;
    await delay(150); // ~100 req/15min = 1 req/9s, pero somos más agresivos
  }

  return all;
}
