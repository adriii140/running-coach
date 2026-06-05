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
  RUN: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  TRAIL_RUN: "bg-green-500/10 text-green-600 dark:text-green-400",
  VIRTUAL_RUN: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400",
  STRENGTH: "bg-orange-500/10 text-orange-600 dark:text-orange-400",
  CYCLING: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400",
  SWIMMING: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400",
  WALKING: "bg-gray-500/10 text-gray-600 dark:text-gray-400",
  OTHER: "bg-gray-500/10 text-gray-600 dark:text-gray-400",
};

export function RecentActivities({ activities }: RecentActivitiesProps) {
  if (activities.length === 0) {
    return (
      <Card className="border-border/50">
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
    <Card className="border-border/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Actividades recientes</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y divide-border/50">
          {activities.map((activity) => {
            const pace = activity.averageSpeed
              ? speedToSecPerKm(activity.averageSpeed)
              : null;

            return (
              <div
                key={activity.id}
                className="flex items-center gap-3 px-6 py-3 hover:bg-muted/30 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge
                      variant="secondary"
                      className={`text-xs px-1.5 py-0 ${activityColors[activity.activityType] ?? activityColors.OTHER}`}
                    >
                      {activityTypeLabel(activity.activityType)}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {formatRelativeDate(activity.startDate)}
                    </span>
                  </div>
                  <p className="text-sm font-medium truncate">{activity.name}</p>
                  <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
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
                  <div className="text-right text-xs text-muted-foreground shrink-0">
                    <span className="text-orange-500">↑</span>{" "}
                    {Math.round(activity.totalElevation)}m
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
