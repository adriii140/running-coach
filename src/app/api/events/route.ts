import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { SportEventType, EventPriority } from "@prisma/client";

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const events = await prisma.sportEvent.findMany({
    where: { userId: session.userId },
    orderBy: { date: "asc" },
  });

  return NextResponse.json(events);
}

export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const {
    name, eventType, date, distanceKm, location, city, country,
    url, price, registered, priority, elevationGain, notes,
  } = body;

  if (!name || !eventType || !date) {
    return NextResponse.json({ error: "name, eventType y date son obligatorios" }, { status: 400 });
  }

  const event = await prisma.sportEvent.create({
    data: {
      userId: session.userId,
      name,
      eventType: eventType as SportEventType,
      date: new Date(date),
      distanceKm: distanceKm ? parseFloat(distanceKm) : null,
      location: location || null,
      city: city || null,
      country: country || null,
      url: url || null,
      price: price ? parseFloat(price) : null,
      registered: registered ?? false,
      priority: (priority as EventPriority) ?? "SECONDARY",
      elevationGain: elevationGain ? parseFloat(elevationGain) : null,
      notes: notes || null,
    },
  });

  return NextResponse.json(event, { status: 201 });
}
