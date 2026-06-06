import { NextRequest } from "next/server";
import { getSessionFromRequest } from "@/lib/auth/session";
import { streamFromModel, getDefaultModelId, type ChatMessage } from "@/lib/ai/client";
import { buildCoachSystemPrompt } from "@/lib/ai/coach-prompt";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });

  let messages: ChatMessage[];
  let modelId: string;
  try {
    const body = await req.json();
    messages = body.messages;
    modelId = body.modelId ?? getDefaultModelId();
    if (!Array.isArray(messages) || messages.length === 0) throw new Error("Invalid messages");
  } catch {
    return new Response(JSON.stringify({ error: "Bad request" }), { status: 400 });
  }

  const [brain, recentActivities] = await Promise.all([
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
  ]);

  const systemPrompt = buildCoachSystemPrompt({ name: session.name, brain, recentActivities });
  const fullMessages: ChatMessage[] = [{ role: "system", content: systemPrompt }, ...messages];

  try {
    const { stream, modelUsed, provider } = await streamFromModel(modelId, fullMessages);

    const encoder = new TextEncoder();
    const responseStream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const reader = stream.getReader();
        let fullText = "";
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            fullText += value;
            controller.enqueue(encoder.encode(value));
          }
        } finally {
          reader.releaseLock();
          controller.close();
          saveConversation(session.userId, messages, fullText, provider, modelUsed).catch(
            (e) => console.error("Error saving conversation:", e)
          );
        }
      },
    });

    return new Response(responseStream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "no-cache",
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

async function saveConversation(
  userId: string, userMessages: ChatMessage[], assistantReply: string,
  provider: string, model: string
) {
  await prisma.aIConversation.create({
    data: {
      userId,
      messages: [...userMessages, { role: "assistant", content: assistantReply }] as never,
      provider,
      model,
    },
  });
}
