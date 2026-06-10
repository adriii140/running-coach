import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

export interface AIRouteParams {
  distanceKm: number;
  maxElevationM: number;
  sessionType: "recovery" | "easy" | "tempo" | "intervals" | "long";
  intensity: string;
  targetPaceMinKm: string;
  reasoning: string;
}

export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [brain, recentActivities, upcomingEvents, activeGoals] = await Promise.all([
    prisma.runningBrain.findUnique({ where: { userId: session.userId } }),
    prisma.activity.findMany({
      where: { userId: session.userId },
      orderBy: { startDate: "desc" },
      take: 15,
      select: {
        name: true, activityType: true, startDate: true,
        distance: true, movingTime: true, totalElevation: true,
        averageHeartrate: true,
      },
    }),
    prisma.sportEvent.findMany({
      where: { userId: session.userId, date: { gte: new Date() } },
      orderBy: { date: "asc" },
      take: 3,
    }),
    prisma.goal.findMany({
      where: { userId: session.userId, status: "ACTIVE" },
      take: 3,
    }),
  ]);

  // Calcular carga semanal y TSB
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 3600 * 1000);
  const weekActivities = recentActivities.filter(a => new Date(a.startDate) > weekAgo);
  const weeklyKm = weekActivities.reduce((s, a) => s + (a.distance ? Number(a.distance) / 1000 : 0), 0);

  // Último entreno
  const lastActivity = recentActivities[0];
  const daysSinceLastRun = lastActivity
    ? Math.floor((now.getTime() - new Date(lastActivity.startDate).getTime()) / (1000 * 3600 * 24))
    : null;

  const prompt = `Eres un coach de running experto. Analiza los datos del corredor y decide los parámetros óptimos para su entrenamiento de hoy.

DATOS DEL CORREDOR:
- Nombre: ${session.name}
- CTL (forma crónica): ${brain?.ctl?.toFixed(1) ?? "sin datos"}
- ATL (carga aguda): ${brain?.atl?.toFixed(1) ?? "sin datos"}
- TSB (estado hoy): ${brain?.tsb?.toFixed(1) ?? "sin datos"} (positivo = descansado, negativo = cargado)
- VO2max estimado: ${brain?.vo2max?.toFixed(1) ?? "sin datos"}
- Km esta semana: ${weeklyKm.toFixed(1)} km
- Días desde último entrenamiento: ${daysSinceLastRun ?? "desconocido"}

ÚLTIMAS ACTIVIDADES:
${recentActivities.slice(0, 7).map(a => {
  const km = a.distance ? (Number(a.distance) / 1000).toFixed(1) : "?";
  const min = a.movingTime ? Math.round(Number(a.movingTime) / 60) : "?";
  const d = new Date(a.startDate).toLocaleDateString("es-ES", { day: "numeric", month: "short" });
  return `  - ${d}: ${km} km en ${min} min (D+: ${a.totalElevation ?? "?"}m)`;
}).join("\n")}

PRÓXIMAS CARRERAS:
${upcomingEvents.length > 0
  ? upcomingEvents.map(e => {
      const days = Math.floor((new Date(e.date).getTime() - now.getTime()) / (1000 * 3600 * 24));
      return `  - ${e.name}: en ${days} días (${e.distanceKm ? Number(e.distanceKm) + " km" : "dist. desconocida"})`;
    }).join("\n")
  : "  - Sin carreras próximas registradas"}

OBJETIVOS ACTIVOS:
${activeGoals.length > 0
  ? activeGoals.map(g => `  - ${g.name}`).join("\n")
  : "  - Sin objetivos activos"}

INSTRUCCIÓN: Basándote en estos datos, decide exactamente qué entrenamiento debe hacer hoy.
Ten en cuenta:
- TSB > 10: puede hacer sesión de calidad o larga
- TSB entre -10 y 10: rodaje moderado
- TSB < -10: recuperación activa o descanso
- Si tiene carrera en menos de 10 días: tapering ligero
- Si lleva muchos días sin correr: sesión fácil de reactivación

Responde ÚNICAMENTE con un objeto JSON válido, sin markdown ni texto adicional:
{
  "distanceKm": <número entre 2 y 35>,
  "maxElevationM": <desnivel positivo máximo recomendado en metros, entre 20 y 1500>,
  "sessionType": <"recovery" | "easy" | "tempo" | "intervals" | "long">,
  "intensity": <"Z1" | "Z2" | "Z3" | "Z4">,
  "targetPaceMinKm": <"X:XX" ritmo objetivo por km>,
  "reasoning": <explicación en español de máximo 80 palabras de por qué estos parámetros>
}`;

  const messages: { role: string; content: string }[] = [
    { role: "user", content: prompt },
  ];

  // Llamada directa no-streaming (más fiable para respuestas JSON)
  const apiKey = process.env.GROQ_API_KEY ?? process.env.GEMINI_API_KEY ?? process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "No hay API key de IA configurada" }, { status: 500 });
  }

  try {
    let text = "";

    if (process.env.GROQ_API_KEY) {
      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
        },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages,
          stream: false,
          temperature: 0.3,
          max_tokens: 512,
        }),
      });
      if (!res.ok) {
        const errText = await res.text();
        console.error("Groq error:", res.status, errText);
        throw new Error(`Groq ${res.status}: ${errText}`);
      }
      const data = await res.json();
      text = data.choices?.[0]?.message?.content ?? "";

    } else if (process.env.GEMINI_API_KEY) {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: messages[0].content }] }],
            generationConfig: { maxOutputTokens: 512, temperature: 0.3 },
          }),
        }
      );
      if (!res.ok) throw new Error(`Gemini ${res.status}`);
      const data = await res.json();
      text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

    } else {
      const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
          "HTTP-Referer": process.env.NEXTAUTH_URL ?? "http://localhost:3000",
        },
        body: JSON.stringify({
          model: "meta-llama/llama-3.3-70b-instruct:free",
          messages,
          stream: false,
          temperature: 0.3,
          max_tokens: 512,
        }),
      });
      if (!res.ok) throw new Error(`OpenRouter ${res.status}`);
      const data = await res.json();
      text = data.choices?.[0]?.message?.content ?? "";
    }

    if (!text) throw new Error("Respuesta vacía del modelo");

    // Extraer JSON (puede venir con ```json ... ``` o directo)
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error("AI response sin JSON:", text);
      throw new Error("El modelo no devolvió JSON válido");
    }

    const params: AIRouteParams = JSON.parse(jsonMatch[0]);

    // Validar y clamp
    params.distanceKm = Math.max(2, Math.min(35, Math.round(params.distanceKm * 2) / 2));
    params.maxElevationM = Math.max(20, Math.min(1500, Math.round(params.maxElevationM / 10) * 10));

    return NextResponse.json(params);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("AI params error:", msg);
    return NextResponse.json({ error: `Error consultando al coach IA: ${msg}` }, { status: 500 });
  }
}
