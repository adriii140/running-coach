import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

interface GeneratedSession {
  weekNumber: number;
  dayOffset: number; // días desde startDate (0 = lunes semana 1)
  type: string;
  distanceKm: number | null;
  durationMin: number | null;
  targetPaceSec: number | null;
  elevationM: number | null;
  zone: string | null;
  description: string;
}

interface GeneratedPlan {
  name: string;
  totalWeeks: number;
  sessions: GeneratedSession[];
}

export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const {
    mode,          // "ai" | "manual"
    sportEventId,  // ID de carrera objetivo (opcional)
    goalId,
    startDate,     // ISO string
    daysPerWeek,   // 3 | 4 | 5 | 6
    currentWeeklyKm,
    notes,
    // Para modo manual: array de sesiones directamente
    manualSessions,
    planName,
  } = body;

  const start = new Date(startDate);

  if (mode === "manual" && manualSessions) {
    // Crear plan manual directamente
    const plan = await prisma.trainingPlan.create({
      data: {
        userId: session.userId,
        goalId: goalId ?? null,
        sportEventId: sportEventId ?? null,
        name: planName ?? "Mi plan de entrenamiento",
        startDate: start,
        endDate: new Date(start.getTime() + 90 * 24 * 3600 * 1000),
        type: sportEventId ? "RACE_PREP" : "WEEKLY",
        aiGenerated: false,
        sessions: {
          create: manualSessions.map((s: GeneratedSession) => ({
            weekNumber: s.weekNumber,
            date: new Date(start.getTime() + s.dayOffset * 24 * 3600 * 1000),
            type: s.type as import("@prisma/client").SessionType,
            distanceKm: s.distanceKm,
            durationMin: s.durationMin,
            targetPaceSec: s.targetPaceSec,
            elevationM: s.elevationM,
            zone: s.zone,
            description: s.description,
          })),
        },
      },
      include: { sessions: { orderBy: { date: "asc" } } },
    });
    return NextResponse.json(plan);
  }

  // Modo IA: generar el plan
  const [brain, recentActivities, allUpcomingRaces, targetEvent] = await Promise.all([
    prisma.runningBrain.findUnique({ where: { userId: session.userId } }),
    prisma.activity.findMany({
      where: { userId: session.userId },
      orderBy: { startDate: "desc" },
      take: 20,
      select: { distance: true, movingTime: true, totalElevation: true, startDate: true, activityType: true },
    }),
    // Todas las carreras futuras ordenadas por fecha
    prisma.sportEvent.findMany({
      where: { userId: session.userId, date: { gte: start } },
      orderBy: { date: "asc" },
      select: { id: true, name: true, date: true, distanceKm: true, priority: true },
    }),
    sportEventId ? prisma.sportEvent.findUnique({ where: { id: sportEventId } }) : null,
  ]);

  // Carrera principal: la seleccionada o la próxima primaria/secundaria
  const primaryRace = targetEvent ?? allUpcomingRaces.find(e => e.priority === "PRIMARY") ?? allUpcomingRaces[0] ?? null;
  const raceDate = primaryRace ? new Date(primaryRace.date) : null;
  const weeksToRace = raceDate
    ? Math.max(4, Math.floor((raceDate.getTime() - start.getTime()) / (7 * 24 * 3600 * 1000)))
    : 12;

  const raceName = primaryRace?.name ?? "sin carrera objetivo";
  const raceDistance = primaryRace?.distanceKm ? Number(primaryRace.distanceKm) : null;
  const avgWeeklyKm = currentWeeklyKm ?? (
    recentActivities
      .filter(a => new Date(a.startDate) > new Date(Date.now() - 28 * 24 * 3600 * 1000))
      .reduce((s, a) => s + (a.distance ? Number(a.distance) / 1000 : 0), 0) / 4
  );

  // Resumen de todas las carreras para el prompt
  const racesSection = allUpcomingRaces.length > 0
    ? `\nCARRERAS EN CALENDARIO:\n${allUpcomingRaces.map(e => {
        const w = Math.floor((new Date(e.date).getTime() - start.getTime()) / (7 * 24 * 3600 * 1000));
        return `  - ${e.name}${e.distanceKm ? ` (${e.distanceKm}km)` : ""} — ${new Date(e.date).toLocaleDateString("es-ES")} (semana ${w} del plan)${e.priority === "PRIMARY" ? " ⭐ PRINCIPAL" : ""}`;
      }).join("\n")}`
    : "";

  const prompt = `Eres un coach de running experto. Genera un plan de entrenamiento personalizado en JSON.

DATOS DEL CORREDOR:
- CTL actual: ${brain?.ctl?.toFixed(1) ?? "sin datos"}
- VO2max estimado: ${brain?.vo2max?.toFixed(1) ?? "sin datos"}
- Ritmo umbral: ${brain?.paceThresholdSec ? `${Math.floor(brain.paceThresholdSec/60)}:${String(Math.round(brain.paceThresholdSec%60)).padStart(2,"0")} /km` : "sin datos"}
- Media km/semana últimas 4 sem: ${avgWeeklyKm.toFixed(1)} km
- Días disponibles por semana: ${daysPerWeek}
- Carrera objetivo principal: ${raceName}${raceDistance ? ` (${raceDistance} km)` : ""}
- Semanas hasta el objetivo: ${weeksToRace}
- Fecha inicio: ${start.toLocaleDateString("es-ES")}
- Notas del corredor: ${notes ?? "ninguna"}
${racesSection}

ÚLTIMAS 10 ACTIVIDADES:
${recentActivities.slice(0, 10).map(a => {
  const km = a.distance ? (Number(a.distance) / 1000).toFixed(1) : "?";
  const min = a.movingTime ? Math.round(Number(a.movingTime) / 60) : "?";
  return `  - ${new Date(a.startDate).toLocaleDateString("es-ES")}: ${km}km en ${min}min`;
}).join("\n")}

INSTRUCCIONES:
Genera un plan de ${weeksToRace} semanas con ${daysPerWeek} días de entreno por semana.
Sigue la regla del 10% (no aumentes más del 10% de km semanales).
Incluye semanas de descarga cada 3-4 semanas (reduce volumen 20-30%).
Si hay carrera objetivo principal, incluye tapering las 2 últimas semanas antes.
Si hay carreras secundarias en el calendario, ajusta la carga esa semana (reducción ligera) y trátala como rodaje fuerte, no como tapering completo.
Para cada sesión incluye descripción breve y concreta en español.

Tipos de sesión válidos: EASY, LONG, TEMPO, INTERVALS, RECOVERY, REST

Zonas: Z1 (muy fácil), Z2 (fácil/aeróbico), Z3 (umbral bajo), Z4 (umbral), Z5 (VO2max)

Ritmos aproximados (ajusta según el nivel del corredor):
- Z1/RECOVERY: pace muy suave, conversación posible
- Z2/EASY: rodaje fácil, puede hablar
- TEMPO: al umbral, 20-40min
- INTERVALS: series cortas con recuperación

Responde ÚNICAMENTE con JSON válido (sin markdown):
{
  "name": "string — nombre del plan",
  "totalWeeks": ${weeksToRace},
  "sessions": [
    {
      "weekNumber": 1,
      "dayOffset": 0,
      "type": "EASY",
      "distanceKm": 8,
      "durationMin": 48,
      "targetPaceSec": 360,
      "elevationM": 50,
      "zone": "Z2",
      "description": "Rodaje fácil de activación. Ritmo conversacional todo el tiempo."
    }
  ]
}

dayOffset = días desde la fecha de inicio (0 = primer día del plan).
Genera todos los entrenamientos del plan completo (${weeksToRace * daysPerWeek} sesiones aprox).
Los días REST no hace falta incluirlos.`;

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
          messages: [{ role: "user", content: prompt }],
          stream: false,
          temperature: 0.4,
          max_tokens: 4096,
        }),
      });
      if (!res.ok) throw new Error(`Groq ${res.status}: ${await res.text()}`);
      const data = await res.json();
      text = data.choices?.[0]?.message?.content ?? "";
    } else if (process.env.GEMINI_API_KEY) {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig: { maxOutputTokens: 4096, temperature: 0.4 },
          }),
        }
      );
      if (!res.ok) throw new Error(`Gemini ${res.status}`);
      const data = await res.json();
      text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    } else {
      throw new Error("No hay API key de IA configurada");
    }

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("El modelo no devolvió JSON válido");

    let generated: GeneratedPlan;
    try {
      generated = JSON.parse(jsonMatch[0]);
    } catch {
      throw new Error("El modelo devolvió JSON malformado");
    }
    if (!Array.isArray(generated?.sessions) || generated.sessions.length === 0) {
      throw new Error("El plan generado no contiene sesiones válidas");
    }

    // Guardar en BD
    const plan = await prisma.trainingPlan.create({
      data: {
        userId: session.userId,
        goalId: goalId ?? null,
        sportEventId: sportEventId ?? null,
        name: generated.name,
        startDate: start,
        endDate: new Date(start.getTime() + weeksToRace * 7 * 24 * 3600 * 1000),
        type: sportEventId ? "RACE_PREP" : "WEEKLY",
        aiGenerated: true,
        notes: notes ?? null,
        sessions: {
          create: generated.sessions.map((s) => ({
            weekNumber: s.weekNumber,
            date: new Date(start.getTime() + s.dayOffset * 24 * 3600 * 1000),
            type: s.type as import("@prisma/client").SessionType,
            distanceKm: s.distanceKm,
            durationMin: s.durationMin,
            targetPaceSec: s.targetPaceSec,
            elevationM: s.elevationM,
            zone: s.zone,
            description: s.description,
          })),
        },
      },
      include: { sessions: { orderBy: { date: "asc" } } },
    });

    return NextResponse.json(plan);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("Plan generation error:", msg);
    return NextResponse.json({ error: `Error generando plan: ${msg}` }, { status: 500 });
  }
}
