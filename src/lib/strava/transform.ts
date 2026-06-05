import { ActivityType } from "@prisma/client";
import type { StravaActivity } from "@/types/strava.types";

// Mapeo de tipos de actividad Strava → nuestro enum
export function mapStravaType(stravaType: string): ActivityType {
  const map: Record<string, ActivityType> = {
    Run: ActivityType.RUN,
    TrailRun: ActivityType.TRAIL_RUN,
    VirtualRun: ActivityType.VIRTUAL_RUN,
    Ride: ActivityType.CYCLING,
    VirtualRide: ActivityType.CYCLING,
    Swim: ActivityType.SWIMMING,
    Walk: ActivityType.WALKING,
    Hike: ActivityType.WALKING,
    WeightTraining: ActivityType.STRENGTH,
    Workout: ActivityType.STRENGTH,
    Crossfit: ActivityType.STRENGTH,
    Yoga: ActivityType.OTHER,
    Elliptical: ActivityType.OTHER,
    StairStepper: ActivityType.OTHER,
  };

  return map[stravaType] ?? ActivityType.OTHER;
}

// Transforma una actividad Strava al formato de nuestra BD
export function transformStravaActivity(
  activity: StravaActivity,
  userId: string
) {
  return {
    userId,
    stravaId: String(activity.id),
    name: activity.name,
    activityType: mapStravaType(activity.sport_type || activity.type),
    startDate: new Date(activity.start_date),
    distance: activity.distance || null,
    movingTime: activity.moving_time,
    elapsedTime: activity.elapsed_time,
    totalElevation: activity.total_elevation_gain || null,
    averageSpeed: activity.average_speed || null,
    maxSpeed: activity.max_speed || null,
    averageHeartrate: activity.average_heartrate ?? null,
    maxHeartrate: activity.max_heartrate ?? null,
    averageCadence: activity.average_cadence ?? null,
    sufferScore: activity.suffer_score ?? null,
    hasHeartrate: activity.has_heartrate,
    startLat: activity.start_latlng?.[0] ?? null,
    startLng: activity.start_latlng?.[1] ?? null,
    mapPolyline: activity.map?.summary_polyline ?? null,
    notes: activity.description ?? null,
  };
}

// Formatea segundos como "MM:SS" o "H:MM:SS"
export function formatTime(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = Math.floor(totalSeconds % 60);

  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  return `${m}:${String(s).padStart(2, "0")}`;
}

// Convierte m/s a min/km (retorna segundos por km)
export function speedToSecPerKm(speedMs: number): number {
  if (speedMs <= 0) return 0;
  return Math.round(1000 / speedMs);
}

// Formatea ritmo en seg/km como "M:SS /km"
export function formatPace(secPerKm: number): string {
  if (!secPerKm || secPerKm <= 0) return "—";
  const m = Math.floor(secPerKm / 60);
  const s = Math.floor(secPerKm % 60);
  return `${m}:${String(s).padStart(2, "0")} /km`;
}

// Metros a km redondeado
export function metersToKm(meters: number): number {
  return Math.round(meters / 10) / 100;
}
