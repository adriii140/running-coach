"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, Clock, TrendingUp, Zap } from "lucide-react";
import { formatDistance, formatTime, formatElevation } from "@/components/shared/format";

interface WeeklySummaryProps {
  activities: Array<{
    distance: number | null;
    movingTime: number;
    totalElevation: number | null;
    activityType: string;
  }>;
}

export function WeeklySummary({ activities }: WeeklySummaryProps) {
  const runActivities = activities.filter((a) =>
    ["RUN", "TRAIL_RUN", "VIRTUAL_RUN"].includes(a.activityType)
  );

  const totalDistanceM = runActivities.reduce((s, a) => s + (a.distance ?? 0), 0);
  const totalSeconds = runActivities.reduce((s, a) => s + a.movingTime, 0);
  const totalElevation = runActivities.reduce((s, a) => s + (a.totalElevation ?? 0), 0);
  const sessionCount = activities.length;

  const stats = [
    {
      label: "Kilómetros",
      value: `${(totalDistanceM / 1000).toFixed(1)} km`,
      icon: Activity,
      color: "text-blue-500",
      bg: "bg-blue-500/10",
    },
    {
      label: "Tiempo",
      value: formatTime(totalSeconds),
      icon: Clock,
      color: "text-green-500",
      bg: "bg-green-500/10",
    },
    {
      label: "Desnivel",
      value: formatElevation(totalElevation),
      icon: TrendingUp,
      color: "text-orange-500",
      bg: "bg-orange-500/10",
    },
    {
      label: "Entrenamientos",
      value: String(sessionCount),
      icon: Zap,
      color: "text-purple-500",
      bg: "bg-purple-500/10",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {stats.map((stat) => (
        <Card key={stat.label} className="border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className={`rounded-lg p-2 ${stat.bg}`}>
                <stat.icon className={`h-4 w-4 ${stat.color}`} />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
                <p className="text-lg font-bold">{stat.value}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
