import type { RunningBrain, Activity, ActivityType } from "@prisma/client";

interface UpcomingEvent {
  id: string;
  name: string;
  eventType: string;
  date: string;
  distanceKm: number | null;
  city: string | null;
  elevationGain: number | null;
  priority: string;
  registered: boolean;
  notes: string | null;
}

interface ActiveGoal {
  id: string;
  name: string;
  type: string;
  notes: string | null;
  targetDate: string | null;
  distanceKm: number | null;
  targetTimeSec: number | null;
  status: string;
}

interface CoachContext {
  name: string;
  brain: RunningBrain | null;
  recentActivities: Pick<Activity, "name" | "activityType" | "startDate" | "distance" | "movingTime" | "totalElevation" | "averageHeartrate">[];
  upcomingEvents?: UpcomingEvent[];
  activeGoals?: ActiveGoal[];
}

export function buildCoachSystemPrompt(ctx: CoachContext): string {
  const { name, brain, recentActivities, upcomingEvents = [], activeGoals = [] } = ctx;
  const today = new Date();

  // ── Running Brain ──────────────────────────────────────────────────────────
  const brainSection = brain ? `
## Estado de forma actual

**Carga de entrenamiento (modelo Banister)**
- Fitness (CTL): ${brain.ctl?.toFixed(1) ?? "N/A"}
- Fatiga (ATL): ${brain.atl?.toFixed(1) ?? "N/A"}
- Forma (TSB): ${brain.tsb?.toFixed(1) ?? "N/A"} → ${getTsbStatus(brain.tsb)}
- Carga esta semana: ${brain.weeklyLoadKm?.toFixed(1) ?? 0} km | Este mes: ${brain.monthlyLoadKm?.toFixed(1) ?? 0} km

**VO2max estimado:** ${brain.vo2max ? `${brain.vo2max.toFixed(1)} ml/kg/min` : "Sin datos suficientes"}

**Récords personales**
${brain.best5kSec ? `- 5K: ${formatTime(brain.best5kSec)}` : "- 5K: sin dato"}
${brain.best10kSec ? `- 10K: ${formatTime(brain.best10kSec)}` : "- 10K: sin dato"}
${brain.bestHalfSec ? `- Media maratón: ${formatTime(brain.bestHalfSec)}` : "- Media maratón: sin dato"}
${brain.bestMarathonSec ? `- Maratón: ${formatTime(brain.bestMarathonSec)}` : "- Maratón: sin dato"}

**Zonas de ritmo**
${formatPaceZones(brain)}

**Historial total:** ${brain.totalDistanceKm?.toFixed(0) ?? 0} km · ${brain.totalActivities ?? 0} actividades`
  : `\n## Estado de forma\nSin datos suficientes (sincroniza actividades de Strava para activar el Running Brain).`;

  // ── Carreras próximas ──────────────────────────────────────────────────────
  const eventsSection = upcomingEvents.length > 0 ? `
## Carreras y eventos próximos
${upcomingEvents.map((e) => {
    const daysUntil = Math.round((new Date(e.date).getTime() - today.getTime()) / 86400000);
    const priority = e.priority === "PRIMARY" ? "🎯 OBJETIVO PRINCIPAL" : e.priority === "SECONDARY" ? "⭐ Secundaria" : "📌 Preparatoria";
    const registered = e.registered ? "✅ Inscrito" : "⏳ Pendiente inscripción";
    return `- **${e.name}** — en ${daysUntil} días (${new Date(e.date).toLocaleDateString("es-ES", { day: "numeric", month: "long" })})
  ${priority} | ${e.distanceKm ? `${e.distanceKm} km` : "distancia desconocida"}${e.elevationGain ? ` · ${e.elevationGain}m D+` : ""}${e.city ? ` | ${e.city}` : ""} | ${registered}${e.notes ? `\n  Notas: ${e.notes}` : ""}`;
  }).join("\n")}` : "";

  // ── Objetivos activos ──────────────────────────────────────────────────────
  const goalsSection = activeGoals.length > 0 ? `
## Objetivos activos
${activeGoals.map((g) => {
    const detail = g.distanceKm
      ? ` ${g.distanceKm} km`
      : g.targetTimeSec
        ? ` en ${formatTime(g.targetTimeSec)}`
        : "";
    const deadline = g.targetDate
      ? ` | Fecha: ${new Date(g.targetDate).toLocaleDateString("es-ES", { day: "numeric", month: "long" })}`
      : "";
    return `- **${g.name}** (${g.type})${detail}${deadline}${g.notes ? `: ${g.notes}` : ""}`;
  }).join("\n")}` : "";

  // ── Actividades recientes ──────────────────────────────────────────────────
  const activitiesSection = recentActivities.length > 0 ? `
## Últimas actividades (${Math.min(recentActivities.length, 15)})
${recentActivities.slice(0, 15).map((a) => {
    const km = a.distance ? (a.distance / 1000).toFixed(2) : "?";
    const pace = a.distance && a.movingTime ? formatPace(a.movingTime / (a.distance / 1000)) : "?";
    const date = new Date(a.startDate).toLocaleDateString("es-ES", { weekday: "short", day: "2-digit", month: "short" });
    const elev = a.totalElevation && a.totalElevation > 5 ? ` · ↑${Math.round(Number(a.totalElevation))}m` : "";
    const hr = a.averageHeartrate ? ` · ${Math.round(Number(a.averageHeartrate))} ppm` : "";
    const type = a.activityType === "RUN" || a.activityType === "TRAIL_RUN" || a.activityType === "VIRTUAL_RUN" ? "🏃" : a.activityType === "WALKING" ? "🚶" : a.activityType === "CYCLING" ? "🚴" : "🏋️";
    return `- ${date} ${type} ${km} km @ ${pace}/km${elev}${hr}`;
  }).join("\n")}` : "\n## Últimas actividades\nSin actividades registradas aún.";

  // ── Contexto temporal ──────────────────────────────────────────────────────
  const nextRace = upcomingEvents[0];
  const urgency = nextRace
    ? (() => {
        const days = Math.round((new Date(nextRace.date).getTime() - today.getTime()) / 86400000);
        if (days <= 7) return `⚠️ CARRERA EN ${days} DÍAS: ${nextRace.name}. Fase de tapering/descanso activo.`;
        if (days <= 21) return `📅 Preparación final para ${nextRace.name} (${days} días). Reduce volumen, mantén intensidad.`;
        if (days <= 60) return `🎯 Bloque de entrenamiento hacia ${nextRace.name} (${days} días).`;
        return "";
      })()
    : "";

  return `Eres el Coach AI personal de ${name}, entrenador experto en running, trail y atletismo de fondo.

Tu misión: analizar los datos reales del atleta y dar consejos CONCRETOS, PERSONALIZADOS y ACCIONABLES.
- Habla siempre en español, de forma directa y motivadora
- Usa los datos reales del atleta (ritmos, carga, récords) en cada respuesta
- Cuando sugieras ritmos, usa min:seg/km basándote en sus zonas calculadas
- Si hay carreras próximas, ten en cuenta el tiempo disponible para preparar
- Si el atleta pregunta por un plan, dáselo día a día con distancias y ritmos concretos
- Responde en markdown: usa **negrita**, listas con guiones y encabezados con ##
${urgency ? `\n${urgency}\n` : ""}
${brainSection}
${eventsSection}
${goalsSection}
${activitiesSection}

Hoy es ${today.toLocaleDateString("es-ES", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}.`;
}

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.round(seconds % 60);
  if (h > 0) return `${h}h ${m.toString().padStart(2, "0")}m ${s.toString().padStart(2, "0")}s`;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function formatPace(secPerKm: number): string {
  const m = Math.floor(secPerKm / 60);
  const s = Math.round(secPerKm % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function getTsbStatus(tsb: number | null): string {
  if (tsb === null) return "Sin datos";
  if (tsb > 10) return "🟢 Descansado / listo para competir";
  if (tsb > -10) return "🟡 Óptimo para entrenar";
  if (tsb > -30) return "🟠 Cargado / fatiga acumulada";
  return "🔴 Sobreentrenamiento — descanso necesario";
}

function formatPaceZones(brain: RunningBrain): string {
  const zones = [
    { name: "Recuperación (Z1)", value: brain.paceRecoverySec },
    { name: "Fácil (Z2)",        value: brain.paceEasySec },
    { name: "Aeróbico (Z3)",     value: brain.paceAerobicSec },
    { name: "Tempo (Z4)",        value: brain.paceTempoSec },
    { name: "Umbral (Z5)",       value: brain.paceThresholdSec },
  ];
  return zones.map((z) =>
    z.value ? `- ${z.name}: ${formatPace(z.value)} /km` : `- ${z.name}: sin dato`
  ).join("\n");
}
