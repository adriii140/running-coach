import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

// PATCH — marcar sesión como completada, saltada, o restaurar pendiente
export async function PATCH(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { sessionId, action, activityId } = await req.json();
  // action: "complete" | "skip" | "reset"

  // Verificar que la sesión pertenece al usuario
  const plannedSession = await prisma.plannedSession.findFirst({
    where: { id: sessionId, plan: { userId: session.userId } },
  });
  if (!plannedSession) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const data =
    action === "complete" ? { completed: true, skipped: false, activityId: activityId ?? null }
    : action === "skip"   ? { skipped: true, completed: false }
    :                       { completed: false, skipped: false, activityId: null };

  const updated = await prisma.plannedSession.update({
    where: { id: sessionId },
    data,
  });
  return NextResponse.json(updated);
}
