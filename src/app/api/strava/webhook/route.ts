import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { syncSingleActivity, deleteActivity } from "@/lib/strava/sync";
import type { StravaWebhookEvent } from "@/types/strava.types";

// GET: verificación del webhook por parte de Strava
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (
    mode === "subscribe" &&
    token === process.env.STRAVA_WEBHOOK_VERIFY_TOKEN
  ) {
    return NextResponse.json({ "hub.challenge": challenge });
  }

  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

// POST: evento del webhook de Strava
export async function POST(req: Request) {
  const event: StravaWebhookEvent = await req.json();

  // Solo procesar eventos de actividades
  if (event.object_type !== "activity") {
    return NextResponse.json({ received: true });
  }

  // Buscar el usuario por su stravaId
  const user = await prisma.user.findUnique({
    where: { stravaId: String(event.owner_id) },
    select: { id: true },
  });

  if (!user) {
    return NextResponse.json({ received: true });
  }

  // Procesar de forma asíncrona (no bloquear la respuesta al webhook)
  if (event.aspect_type === "create" || event.aspect_type === "update") {
    syncSingleActivity(user.id, event.object_id).catch(console.error);
  } else if (event.aspect_type === "delete") {
    deleteActivity(event.object_id).catch(console.error);
  }

  // Strava requiere respuesta en < 2 segundos
  return NextResponse.json({ received: true });
}
