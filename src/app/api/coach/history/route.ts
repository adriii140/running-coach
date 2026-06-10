import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

// GET — lista todas las conversaciones o carga una específica (?id=xxx)
export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (id) {
    const conversation = await prisma.aIConversation.findFirst({
      where: { id, userId: session.userId },
    });
    if (!conversation) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({
      messages: conversation.messages,
      conversationId: conversation.id,
      title: conversation.title,
    });
  }

  // Listar todas las conversaciones con preview
  const conversations = await prisma.aIConversation.findMany({
    where: { userId: session.userId },
    orderBy: { updatedAt: "desc" },
    select: { id: true, title: true, createdAt: true, updatedAt: true, messages: true },
  });

  const list = conversations.map((conv) => {
    const msgs = conv.messages as Array<{ role: string; content: string }>;
    const firstUser = msgs.find((m) => m.role === "user");
    const messageCount = msgs.filter((m) => m.role !== "system").length;
    return {
      id: conv.id,
      title: conv.title ?? firstUser?.content?.slice(0, 60) ?? "Conversación",
      preview: firstUser?.content?.slice(0, 100) ?? "",
      messageCount,
      updatedAt: conv.updatedAt,
      createdAt: conv.createdAt,
    };
  });

  return NextResponse.json({ conversations: list });
}

// POST — crear o actualizar conversación
export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { conversationId, messages, provider, model, title } = await req.json();

  if (conversationId) {
    const updated = await prisma.aIConversation.update({
      where: { id: conversationId, userId: session.userId },
      data: {
        messages: messages as never,
        provider, model,
        ...(title !== undefined ? { title } : {}),
        updatedAt: new Date(),
      },
    });
    return NextResponse.json({ conversationId: updated.id });
  } else {
    const created = await prisma.aIConversation.create({
      data: {
        userId: session.userId,
        messages: (messages ?? []) as never,
        provider, model,
        title: title ?? null,
      },
    });
    return NextResponse.json({ conversationId: created.id });
  }
}

// DELETE — borrar conversación (?id=xxx) o todas si no hay id
export async function DELETE(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (id) {
    await prisma.aIConversation.deleteMany({ where: { id, userId: session.userId } });
  } else {
    await prisma.aIConversation.deleteMany({ where: { userId: session.userId } });
  }

  return NextResponse.json({ ok: true });
}

// PATCH — renombrar conversación
export async function PATCH(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, title } = await req.json();
  if (!id || !title) return NextResponse.json({ error: "id y title requeridos" }, { status: 400 });

  await prisma.aIConversation.update({
    where: { id, userId: session.userId },
    data: { title },
  });

  return NextResponse.json({ ok: true });
}
