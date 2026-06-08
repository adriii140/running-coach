import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

// GET — cargar historial de la conversación activa del usuario
export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Buscar la conversación activa (la más reciente)
  const conversation = await prisma.aIConversation.findFirst({
    where: { userId: session.userId },
    orderBy: { updatedAt: "desc" },
  });

  if (!conversation) return NextResponse.json({ messages: [], conversationId: null });

  return NextResponse.json({
    messages: conversation.messages,
    conversationId: conversation.id,
  });
}

// POST — guardar/actualizar la conversación activa
export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { conversationId, messages, provider, model } = await req.json();

  if (conversationId) {
    // Actualizar conversación existente
    const updated = await prisma.aIConversation.update({
      where: { id: conversationId, userId: session.userId },
      data: { messages: messages as never, provider, model, updatedAt: new Date() },
    });
    return NextResponse.json({ conversationId: updated.id });
  } else {
    // Crear nueva conversación
    const created = await prisma.aIConversation.create({
      data: { userId: session.userId, messages: messages as never, provider, model },
    });
    return NextResponse.json({ conversationId: created.id });
  }
}

// DELETE — borrar historial (nueva conversación)
export async function DELETE(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await prisma.aIConversation.deleteMany({ where: { userId: session.userId } });
  return NextResponse.json({ ok: true });
}
