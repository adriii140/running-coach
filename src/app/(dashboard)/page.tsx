import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { WeeklySummary } from "@/components/dashboard/WeeklySummary";
import { BrainStats } from "@/components/dashboard/BrainStats";
import { RecentActivities } from "@/components/dashboard/RecentActivities";
import { SyncButton } from "@/components/dashboard/SyncButton";
import { TodaySession } from "@/components/dashboard/TodaySession";
import { startOfWeek } from "date-fns";

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const isDatabaseConfigured =
    !!process.env.DATABASE_URL &&
    !process.env.DATABASE_URL.includes("placeholder");

  // Sin BD: mostrar dashboard vacío con mensaje
  if (!isDatabaseConfigured) {
    return (
      <div className="space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold">
              Hola, {session.name.split(" ")[0]} 👋
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Conectado con Strava correctamente
            </p>
          </div>
        </div>
        <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/10 p-4">
          <p className="text-sm font-medium text-yellow-600 dark:text-yellow-400">
            Base de datos no configurada
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            Configura <code className="rounded bg-muted px-1">DATABASE_URL</code> en{" "}
            <code className="rounded bg-muted px-1">.env.local</code> con tu
            URL de Supabase para activar la sincronización de actividades.
          </p>
        </div>
      </div>
    );
  }

  const { prisma } = await import("@/lib/db/prisma");
  const userId = session.userId;
  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });

  const todayStart = new Date(); todayStart.setHours(0,0,0,0);
  const todayEnd = new Date(); todayEnd.setHours(23,59,59,999);

  const [weeklyActivities, recentActivities, brain, todayPlanned] = await Promise.all([
    prisma.activity.findMany({
      where: { userId, startDate: { gte: weekStart } },
      select: { distance: true, movingTime: true, totalElevation: true, activityType: true },
    }),
    prisma.activity.findMany({
      where: { userId },
      orderBy: { startDate: "desc" },
      take: 10,
      select: {
        id: true, name: true, activityType: true, startDate: true,
        distance: true, movingTime: true, totalElevation: true,
        averageSpeed: true, averageHeartrate: true,
      },
    }),
    prisma.runningBrain.findUnique({ where: { userId } }),
    prisma.plannedSession.findFirst({
      where: {
        plan: { userId, status: "ACTIVE" },
        date: { gte: todayStart, lte: todayEnd },
      },
      include: { plan: { select: { name: true } } },
    }),
  ]);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Buenos días" : hour < 20 ? "Buenas tardes" : "Buenas noches";

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">
            {greeting}, {session.name.split(" ")[0]} 👋
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {new Date().toLocaleDateString("es-ES", {
              weekday: "long", day: "numeric", month: "long",
            })}
          </p>
        </div>
        <SyncButton />
      </div>

      {todayPlanned && (
        <TodaySession
          session={{
            id: todayPlanned.id,
            type: todayPlanned.type,
            distanceKm: todayPlanned.distanceKm ? Number(todayPlanned.distanceKm) : null,
            durationMin: todayPlanned.durationMin,
            elevationM: todayPlanned.elevationM,
            zone: todayPlanned.zone,
            description: todayPlanned.description ?? null,
            completed: todayPlanned.completed,
            skipped: todayPlanned.skipped,
            planName: (todayPlanned as never as { plan: { name: string } }).plan.name,
          }}
        />
      )}

      <section>
        <h2 className="text-sm font-medium text-muted-foreground mb-3 uppercase tracking-wide">
          Esta semana
        </h2>
        <WeeklySummary activities={weeklyActivities} />
      </section>

      <section>
        <h2 className="text-sm font-medium text-muted-foreground mb-3 uppercase tracking-wide">
          Running Brain
        </h2>
        <BrainStats brain={brain} />
      </section>

      <section>
        <h2 className="text-sm font-medium text-muted-foreground mb-3 uppercase tracking-wide">
          Actividades recientes
        </h2>
        <RecentActivities activities={recentActivities as never} />
      </section>
    </div>
  );
}
