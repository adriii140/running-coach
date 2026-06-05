export interface StravaTokenResponse {
  token_type: string;
  expires_at: number;
  expires_in: number;
  refresh_token: string;
  access_token: string;
  athlete: StravaAthlete;
}

export interface StravaAthlete {
  id: number;
  username: string;
  firstname: string;
  lastname: string;
  city: string;
  country: string;
  sex: string;
  premium: boolean;
  created_at: string;
  updated_at: string;
  profile_medium: string;
  profile: string;
  email?: string;
}

export interface StravaActivity {
  id: number;
  name: string;
  type: string;
  sport_type: string;
  start_date: string;
  start_date_local: string;
  distance: number;
  moving_time: number;
  elapsed_time: number;
  total_elevation_gain: number;
  average_speed: number;
  max_speed: number;
  average_heartrate?: number;
  max_heartrate?: number;
  average_cadence?: number;
  suffer_score?: number;
  has_heartrate: boolean;
  start_latlng: [number, number] | null;
  end_latlng: [number, number] | null;
  map: {
    id: string;
    summary_polyline: string;
    resource_state: number;
  };
  athlete: { id: number };
  workout_type?: number;
  description?: string;
  gear_id?: string;
  average_watts?: number;
  weighted_average_watts?: number;
  kilojoules?: number;
  device_watts?: boolean;
}

export interface StravaActivityStreams {
  time?: { data: number[]; series_type: string; resolution: string };
  distance?: { data: number[]; series_type: string; resolution: string };
  heartrate?: { data: number[]; series_type: string; resolution: string };
  altitude?: { data: number[]; series_type: string; resolution: string };
  velocity_smooth?: { data: number[]; series_type: string; resolution: string };
  cadence?: { data: number[]; series_type: string; resolution: string };
  latlng?: { data: [number, number][]; series_type: string; resolution: string };
}

export interface StravaLap {
  id: number;
  name: string;
  lap_index: number;
  distance: number;
  moving_time: number;
  elapsed_time: number;
  average_speed: number;
  max_speed: number;
  average_heartrate?: number;
  max_heartrate?: number;
}

export interface StravaWebhookEvent {
  object_type: "activity" | "athlete";
  object_id: number;
  aspect_type: "create" | "update" | "delete";
  owner_id: number;
  subscription_id: number;
  event_time: number;
  updates?: Record<string, string>;
}

export type StravaActivityType =
  | "Run"
  | "TrailRun"
  | "VirtualRun"
  | "Ride"
  | "Swim"
  | "Walk"
  | "WeightTraining"
  | "Workout"
  | "Yoga"
  | "Crossfit"
  | "Elliptical"
  | "StairStepper"
  | string;
