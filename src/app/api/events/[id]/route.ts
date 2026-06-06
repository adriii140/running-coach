import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { SportEventType, EventPriority } from "@prisma/client";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();

  const existing = await prisma.sportEvent.findFirst({
    where: { id, userId: session.userId },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const event = await prisma.sportEvent.update({
    where: { id },
    data: {
      ...(body.name && { name: body.name }),
      ...(body.eventType && { eventType: body.eventType as SportEventType }),
      ...(body.date && { date: new Date(body.date) }),
      ...(body.distanceKm !== undefined && { distanceKm: body.distanceKm ? parseFloat(body.distanceKm) : null }),
      ...(body.location !== undefined && { location: body.location || null }),
      ...(body.city !== undefined && { city: body.city || null }),
      ...(body.country !== undefined && { country: body.country || null }),
      ...(body.url !== undefined && { url: body.url || null }),
      ...(body.price !== undefined && { price: body.price ? parseFloat(body.price) : null }),
      ...(body.registered !== undefined && { registered: body.registered }),
      ...(body.priority && { priority: body.priority as EventPriority }),
      ...(body.elevationGain !== undefined && { elevationGain: body.elevationGain ? parseFloat(body.elevationGain) : null }),
      ...(body.notes !== undefined && { notes: body.notes || null }),
    },
  });

  return NextResponse.json(event);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const existing = await prisma.sportEvent.findFirst({
    where: { id, userId: session.userId },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.sportEvent.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
