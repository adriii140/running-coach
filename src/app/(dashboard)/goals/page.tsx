import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { GoalsList } from "@/components/goals/GoalsList";

export default async function GoalsPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const [goalsRaw, brain] = await Promise.all([
    prisma.goal.findMany({
      where: { userId: session.userId },
      orderBy: { targetDate: "asc" },
    }),
    prisma.runningBrain.findUnique({
      where: { userId: session.userId },
      select: {
        best5kSec: true,
        best10kSec: true,
        bestHalfSec: true,
        bestMarathonSec: true,
      },
    }),
  ]);

  const goals = goalsRaw.map((g) => ({
    id: g.id,
    name: g.name,
    type: g.type as string,
    targetDate: g.targetDate.toISOString(),
    distanceKm: g.distanceKm ? Number(g.distanceKm) : null,
    targetTimeSec: g.targetTimeSec ?? null,
    priority: g.priority,
    status: g.status as string,
    notes: g.notes ?? null,
  }));

  const bestTimes = {
    best5kSec: brain?.best5kSec ? Number(brain.best5kSec) : null,
    best10kSec: brain?.best10kSec ? Number(brain.best10kSec) : null,
    bestHalfSec: brain?.bestHalfSec ? Number(brain.bestHalfSec) : null,
    bestMarathonSec: brain?.bestMarathonSec ? Number(brain.bestMarathonSec) : null,
  };

  return <GoalsList initialGoals={goals} bestTimes={bestTimes} />;
}
