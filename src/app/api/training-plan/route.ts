import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

// GET — obtener el plan activo (con sesiones)
export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const planId = searchParams.get("id");

  if (planId) {
    const plan = await prisma.trainingPlan.findFirst({
      where: { id: planId, userId: session.userId },
      include: { sessions: { orderBy: { date: "asc" } } },
    });
    if (!plan) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(plan);
  }

  // Devolver todos los planes con un resumen de sesiones
  const plans = await prisma.trainingPlan.findMany({
    where: { userId: session.userId },
    orderBy: { createdAt: "desc" },
    include: {
      sessions: {
        orderBy: { date: "asc" },
        select: {
          id: true, date: true, type: true, distanceKm: true, durationMin: true,
          zone: true, completed: true, skipped: true, weekNumber: true,
          description: true, elevationM: true, targetPaceSec: true, notes: true,
        },
      },
    },
  });

  return NextResponse.json({ plans });
}

// DELETE — borrar plan
export async function DELETE(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id requerido" }, { status: 400 });

  try {
    // deleteMany with both id and userId ensures ownership check
    const result = await prisma.trainingPlan.deleteMany({ where: { id, userId: session.userId } });
    if (result.count === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Error al borrar plan" }, { status: 500 });
  }
}

const VALID_STATUSES = ["ACTIVE", "PAUSED", "COMPLETED"] as const;
type PlanStatus = typeof VALID_STATUSES[number];

// PATCH — cambiar estado del plan (pausar, activar, completar)
export async function PATCH(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, status } = await req.json();
  if (!id) return NextResponse.json({ error: "id requerido" }, { status: 400 });
  if (!VALID_STATUSES.includes(status)) return NextResponse.json({ error: "Estado inválido" }, { status: 400 });

  try {
    // Verify ownership first, then update by unique id
    const plan = await prisma.trainingPlan.findFirst({ where: { id, userId: session.userId } });
    if (!plan) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const updated = await prisma.trainingPlan.update({
      where: { id },
      data: { status: status as PlanStatus, updatedAt: new Date() },
    });
    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: "Error al actualizar plan" }, { status: 500 });
  }
}
