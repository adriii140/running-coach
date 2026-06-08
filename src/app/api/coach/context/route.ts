import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";

// GET /api/coach/context — contexto resumido para el cliente (preguntas dinámicas)
export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [brain, nextEvent] = await Promise.all([
    prisma.runningBrain.findUnique({
      where: { userId: session.userId },
      select: { tsb: true, weeklyLoadKm: true, vo2max: true, best5kSec: true },
    }),
    prisma.sportEvent.findFirst({
      where: { userId: session.userId, date: { gte: new Date() } },
      orderBy: { date: "asc" },
      select: { name: true, date: true, distanceKm: true, priority: true },
    }),
  ]);

  const daysUntilRace = nextEvent
    ? Math.round((new Date(nextEvent.date).getTime() - Date.now()) / 86400000)
    : null;

  return NextResponse.json({
    tsb: brain?.tsb ?? null,
    weeklyLoadKm: brain?.weeklyLoadKm ? Number(brain.weeklyLoadKm) : null,
    vo2max: brain?.vo2max ? Number(brain.vo2max) : null,
    has5k: !!brain?.best5kSec,
    nextRace: nextEvent ? {
      name: nextEvent.name,
      daysUntil: daysUntilRace,
      distanceKm: nextEvent.distanceKm ? Number(nextEvent.distanceKm) : null,
      isPrimary: nextEvent.priority === "PRIMARY",
    } : null,
  });
}
