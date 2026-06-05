import { auth } from "@/../auth";
import { prisma } from "@/lib/db/prisma";
import { WeeklySummary } from "@/components/dashboard/WeeklySummary";
import { BrainStats } from "@/components/dashboard/BrainStats";
import { RecentActivities } from "@/components/dashboard/RecentActivities";
import { SyncButton } from "@/components/dashboard/SyncButton";
import { startOfWeek } from "date-fns";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) return null;

  const userId = session.user.id;

  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });

  const [weeklyActivities, recentActivities, brain] = await Promise.all([
    // Actividades de la semana actual
    prisma.activity.findMany({
      where: {
        userId,
        startDate: { gte: weekStart },
      },
      select: {
        distance: true,
        movingTime: true,
        totalElevation: true,
        activityType: true,
      },
    }),

    // Últimas 10 actividades
    prisma.activity.findMany({
      where: { userId },
      orderBy: { startDate: "desc" },
      take: 10,
      select: {
        id: true,
        name: true,
        activityType: true,
        startDate: true,
        distance: true,
        movingTime: true,
        totalElevation: true,
        averageSpeed: true,
        averageHeartrate: true,
      },
    }),

    // Running Brain
    prisma.runningBrain.findUnique({ where: { userId } }),
  ]);

  const firstName = session.user.name?.split(" ")[0] ?? "Corredor";
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Buenos días" : hour < 20 ? "Buenas tardes" : "Buenas noches";

  return (
    <div className="space-y-6">
      {/* Cabecera */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">
            {greeting}, {firstName} 👋
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {new Date().toLocaleDateString("es-ES", {
              weekday: "long",
              day: "numeric",
              month: "long",
            })}
          </p>
        </div>
        <SyncButton />
      </div>

      {/* Resumen semanal */}
      <section>
        <h2 className="text-sm font-medium text-muted-foreground mb-3 uppercase tracking-wide">
          Esta semana
        </h2>
        <WeeklySummary activities={weeklyActivities} />
      </section>

      {/* Running Brain */}
      <section>
        <h2 className="text-sm font-medium text-muted-foreground mb-3 uppercase tracking-wide">
          Running Brain
        </h2>
        <BrainStats brain={brain} />
      </section>

      {/* Actividades recientes */}
      <section>
        <h2 className="text-sm font-medium text-muted-foreground mb-3 uppercase tracking-wide">
          Actividades recientes
        </h2>
        <RecentActivities activities={recentActivities as never} />
      </section>
    </div>
  );
}
