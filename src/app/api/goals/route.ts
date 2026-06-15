import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { GoalType, GoalStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const goals = await prisma.goal.findMany({
    where: { userId: session.userId },
    orderBy: { targetDate: "asc" },
  });

  return NextResponse.json({ goals });
}

export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { name, type, targetDate, distanceKm, targetTimeSec, notes } = body;

  if (!name || !type || !targetDate) {
    return NextResponse.json(
      { error: "name, type y targetDate son obligatorios" },
      { status: 400 }
    );
  }

  const goal = await prisma.goal.create({
    data: {
      userId: session.userId,
      name,
      type: type as GoalType,
      targetDate: new Date(targetDate),
      distanceKm: distanceKm ? parseFloat(distanceKm) : null,
      targetTimeSec: targetTimeSec ? parseInt(targetTimeSec) : null,
      notes: notes || null,
    },
  });

  return NextResponse.json(goal, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { id, ...fields } = body;

  if (!id) return NextResponse.json({ error: "id es obligatorio" }, { status: 400 });

  const existing = await prisma.goal.findFirst({
    where: { id, userId: session.userId },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const updateData: Record<string, unknown> = {};
  if (fields.name !== undefined) updateData.name = fields.name;
  if (fields.type !== undefined) updateData.type = fields.type as GoalType;
  if (fields.targetDate !== undefined) updateData.targetDate = new Date(fields.targetDate);
  if (fields.distanceKm !== undefined) updateData.distanceKm = fields.distanceKm ? parseFloat(fields.distanceKm) : null;
  if (fields.targetTimeSec !== undefined) updateData.targetTimeSec = fields.targetTimeSec ? parseInt(fields.targetTimeSec) : null;
  if (fields.notes !== undefined) updateData.notes = fields.notes || null;
  if (fields.status !== undefined) updateData.status = fields.status as GoalStatus;
  if (fields.priority !== undefined) updateData.priority = parseInt(fields.priority);

  const updated = await prisma.goal.update({
    where: { id },
    data: updateData,
  });

  return NextResponse.json(updated);
}

export async function DELETE(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (!id) return NextResponse.json({ error: "id es obligatorio" }, { status: 400 });

  const existing = await prisma.goal.findFirst({
    where: { id, userId: session.userId },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.goal.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
