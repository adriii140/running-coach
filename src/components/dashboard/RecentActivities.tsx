"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin, Clock, TrendingUp } from "lucide-react";
import {
  formatDistance,
  formatTime,
  formatPace,
  speedToSecPerKm,
  formatRelativeDate,
  activityTypeLabel,
} from "@/components/shared/format";

interface Activity {
  id: string;
  name: string;
  activityType: string;
  startDate: string | Date;
  distance: number | null;
  movingTime: number;
  totalElevation: number | null;
  averageSpeed: number | null;
  averageHeartrate: number | null;
}

interface RecentActivitiesProps {
  activities: Activity[];
}

const activityColors: Record<string, string> = {
  RUN: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  TRAIL_RUN: "bg-green-500/10 text-green-400 border-green-500/20",
  VIRTUAL_RUN: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
  STRENGTH: "bg-orange-500/10 text-orange-400 border-orange-500/20",
  CYCLING: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  SWIMMING: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",
  WALKING: "bg-gray-500/10 text-gray-400 border-gray-500/20",
  OTHER: "bg-gray-500/10 text-gray-400 border-gray-500/20",
};

export function RecentActivities({ activities }: RecentActivitiesProps) {
  if (activities.length === 0) {
    return (
      <Card className="border-border/40 bg-card/50 backdrop-blur-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Actividades recientes</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No hay actividades. Sincroniza con Strava para empezar.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/40 bg-card/50 backdrop-blur-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Actividades recientes</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y divide-border/30">
          {activities.map((activity) => {
            const pace = activity.averageSpeed
              ? speedToSecPerKm(activity.averageSpeed)
              : null;
            const colorClass =
              activityColors[activity.activityType] ?? activityColors.OTHER;

            return (
              <div
                key={activity.id}
                className="flex items-center gap-3 px-5 py-3.5 hover:bg-muted/20 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge
                      variant="outline"
                      className={`text-xs px-1.5 py-0 border ${colorClass}`}
                    >
                      {activityTypeLabel(activity.activityType)}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {formatRelativeDate(activity.startDate)}
                    </span>
                  </div>
                  <p className="text-sm font-medium truncate">{activity.name}</p>
                  <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                    {activity.distance && (
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {formatDistance(activity.distance)}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatTime(activity.movingTime)}
                    </span>
                    {pace && (
                      <span className="flex items-center gap-1">
                        <TrendingUp className="h-3 w-3" />
                        {formatPace(pace)} /km
                      </span>
                    )}
                    {activity.averageHeartrate && (
                      <span className="text-red-400">
                        ♥ {Math.round(activity.averageHeartrate)} bpm
                      </span>
                    )}
                  </div>
                </div>
                {activity.totalElevation && activity.totalElevation > 10 && (
                  <div className="text-right text-xs shrink-0">
                    <span className="text-orange-400 font-semibold">
                      ↑ {Math.round(activity.totalElevation)}m
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
