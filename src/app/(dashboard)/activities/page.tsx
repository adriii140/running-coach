import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { RecentActivities } from "@/components/dashboard/RecentActivities";
import { SyncButton } from "@/components/dashboard/SyncButton";

export default async function ActivitiesPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const isDatabaseConfigured =
    !!process.env.DATABASE_URL && !process.env.DATABASE_URL.includes("placeholder");

  if (!isDatabaseConfigured) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Actividades</h1>
        <p className="text-sm text-muted-foreground">
          Configura Supabase para ver tus actividades.
        </p>
      </div>
    );
  }

  const { prisma } = await import("@/lib/db/prisma");
  const activities = await prisma.activity.findMany({
    where: { userId: session.userId },
    orderBy: { startDate: "desc" },
    take: 50,
    select: {
      id: true, name: true, activityType: true, startDate: true,
      distance: true, movingTime: true, totalElevation: true,
      averageSpeed: true, averageHeartrate: true,
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Actividades</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {activities.length} actividades importadas
          </p>
        </div>
        <SyncButton />
      </div>
      <RecentActivities activities={activities as never} />
    </div>
  );
}
