"use client";

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
      color: "text-blue-400",
      bg: "bg-blue-500/10",
      glow: "shadow-blue-500/10",
      border: "border-blue-500/20",
    },
    {
      label: "Tiempo",
      value: formatTime(totalSeconds),
      icon: Clock,
      color: "text-green-400",
      bg: "bg-green-500/10",
      glow: "shadow-green-500/10",
      border: "border-green-500/20",
    },
    {
      label: "Desnivel",
      value: formatElevation(totalElevation),
      icon: TrendingUp,
      color: "text-orange-400",
      bg: "bg-orange-500/10",
      glow: "shadow-orange-500/10",
      border: "border-orange-500/20",
    },
    {
      label: "Sesiones",
      value: String(sessionCount),
      icon: Zap,
      color: "text-purple-400",
      bg: "bg-purple-500/10",
      glow: "shadow-purple-500/10",
      border: "border-purple-500/20",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {stats.map((stat) => (
        <div
          key={stat.label}
          className={`rounded-xl border ${stat.border} bg-card/50 backdrop-blur-sm p-4 shadow-md ${stat.glow} transition-all hover:bg-card/70`}
        >
          <div className="flex items-start gap-3">
            <div className={`rounded-lg p-2 ${stat.bg} shrink-0`}>
              <stat.icon className={`h-4 w-4 ${stat.color}`} />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">{stat.label}</p>
              <p className="text-xl font-bold mt-0.5 leading-tight">{stat.value}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
