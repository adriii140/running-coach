import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { EventsList } from "@/components/events/EventsList";

export default async function EventsPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const events = await prisma.sportEvent.findMany({
    where: { userId: session.userId },
    orderBy: { date: "asc" },
  });

  // Serializar para el cliente
  const serialized = events.map((e) => ({
    ...e,
    date: e.date.toISOString(),
    createdAt: e.createdAt.toISOString(),
    updatedAt: e.updatedAt.toISOString(),
    distanceKm: e.distanceKm ? Number(e.distanceKm) : null,
    elevationGain: e.elevationGain ? Number(e.elevationGain) : null,
    price: e.price ? Number(e.price) : null,
  }));

  return <EventsList initialEvents={serialized} />;
}
