import { NextRequest } from "next/server";
import { getSessionFromRequest } from "@/lib/auth/session";
import { streamFromModel, getDefaultModelId, type ChatMessage } from "@/lib/ai/client";
import { buildCoachSystemPrompt } from "@/lib/ai/coach-prompt";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });

  let newMessage: ChatMessage;
  let modelId: string;
  let conversationId: string | null;

  try {
    const body = await req.json();
    // Soporte retrocompatibilidad: si viene "messages" (array completo) úsalo, si viene "message" (solo el nuevo) úsalo
    if (body.message) {
      newMessage = body.message;
    } else if (Array.isArray(body.messages) && body.messages.length > 0) {
      newMessage = body.messages[body.messages.length - 1];
    } else {
      throw new Error("No message provided");
    }
    modelId = body.modelId ?? getDefaultModelId();
    conversationId = body.conversationId ?? null;
    if (!newMessage?.content) throw new Error("Invalid message");
  } catch {
    return new Response(JSON.stringify({ error: "Bad request" }), { status: 400 });
  }

  // Cargar historial existente de la conversación
  let history: ChatMessage[] = [];
  let activeConversationId = conversationId;

  if (conversationId && conversationId !== "new") {
    const conv = await prisma.aIConversation.findFirst({
      where: { id: conversationId, userId: session.userId },
    });
    if (conv) history = conv.messages as unknown as ChatMessage[];
  } else if (!conversationId) {
    // Buscar conversación activa más reciente si no se especificó
    const conv = await prisma.aIConversation.findFirst({
      where: { userId: session.userId },
      orderBy: { updatedAt: "desc" },
    });
    if (conv) {
      history = conv.messages as unknown as ChatMessage[];
      activeConversationId = conv.id;
    }
  }

  // Cargar contexto del runner
  const [brain, recentActivities, upcomingEvents, activeGoals] = await Promise.all([
    prisma.runningBrain.findUnique({ where: { userId: session.userId } }),
    prisma.activity.findMany({
      where: { userId: session.userId },
      orderBy: { startDate: "desc" },
      take: 20,
      select: {
        name: true, activityType: true, startDate: true,
        distance: true, movingTime: true, totalElevation: true, averageHeartrate: true,
      },
    }),
    prisma.sportEvent.findMany({
      where: { userId: session.userId, date: { gte: new Date() } },
      orderBy: { date: "asc" },
      take: 5,
    }),
    prisma.goal.findMany({
      where: { userId: session.userId, status: "ACTIVE" },
      take: 5,
    }),
  ]);

  const systemPrompt = buildCoachSystemPrompt({
    name: session.name,
    brain,
    recentActivities,
    upcomingEvents: upcomingEvents.map((e) => ({
      ...e,
      date: e.date.toISOString(),
      distanceKm: e.distanceKm ? Number(e.distanceKm) : null,
      elevationGain: e.elevationGain ? Number(e.elevationGain) : null,
      price: e.price ? Number(e.price) : null,
    })),
    activeGoals: activeGoals.map((g) => ({
      id: g.id, name: g.name, type: g.type, notes: g.notes ?? null,
      targetDate: g.targetDate?.toISOString() ?? null,
      distanceKm: g.distanceKm ? Number(g.distanceKm) : null,
      targetTimeSec: g.targetTimeSec ?? null, status: g.status,
    })),
  });

  // Historial completo: sistema + historial previo + nuevo mensaje
  const fullMessages: ChatMessage[] = [
    { role: "system", content: systemPrompt },
    ...history,
    newMessage,
  ];

  try {
    const { stream, modelUsed, provider } = await streamFromModel(modelId, fullMessages);
    const savedProvider = provider;
    const savedModel = modelUsed;

    const encoder = new TextEncoder();
    // Necesitamos el conversationId antes de enviar headers, así que lo generamos aquí si es nuevo
    let pendingConvId = activeConversationId;

    const responseStream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const reader = stream.getReader();
        let assistantReply = "";
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            assistantReply += value;
            controller.enqueue(encoder.encode(value));
          }
        } finally {
          reader.releaseLock();
          controller.close();

          // Guardar historial actualizado
          const updatedMessages: ChatMessage[] = [
            ...history,
            newMessage,
            { role: "assistant", content: assistantReply },
          ];

          persistHistory(
            session.userId, pendingConvId, updatedMessages, savedProvider, savedModel,
            (newId) => { pendingConvId = newId; }
          ).catch((e) => console.error("Error saving history:", e));
        }
      },
    });

    return new Response(responseStream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "no-cache",
        // El cliente usará este header para saber a qué conversación pertenece la respuesta
        "X-Conversation-Id": activeConversationId ?? "new",
      },
    });
  } catch (err) {
    console.error("AI stream error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "AI error" }),
      { status: 500 }
    );
  }
}

async function persistHistory(
  userId: string,
  conversationId: string | null,
  messages: ChatMessage[],
  provider: string,
  model: string,
  onCreated?: (id: string) => void
) {
  if (conversationId && conversationId !== "new") {
    await prisma.aIConversation.update({
      where: { id: conversationId, userId },
      data: { messages: messages as never, provider, model, updatedAt: new Date() },
    });
  } else {
    const created = await prisma.aIConversation.create({
      data: { userId, messages: messages as never, provider, model },
    });
    onCreated?.(created.id);
  }
}
