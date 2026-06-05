import { auth } from "@/../auth";
import { prisma } from "@/lib/db/prisma";
import { RecentActivities } from "@/components/dashboard/RecentActivities";
import { SyncButton } from "@/components/dashboard/SyncButton";

export default async function ActivitiesPage() {
  const session = await auth();
  if (!session?.user?.id) return null;

  const activities = await prisma.activity.findMany({
    where: { userId: session.user.id },
    orderBy: { startDate: "desc" },
    take: 50,
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
