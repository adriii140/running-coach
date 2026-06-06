import type { RunningBrain, Activity } from "@prisma/client";

interface CoachContext {
  name: string;
  brain: RunningBrain | null;
  recentActivities: Pick<Activity, "name" | "activityType" | "startDate" | "distance" | "movingTime" | "totalElevation" | "averageHeartrate">[];
}

export function buildCoachSystemPrompt(ctx: CoachContext): string {
  const { name, brain, recentActivities } = ctx;

  const brainSection = brain
    ? `
## Datos del Running Brain

### Récords personales
${brain.best5kSec ? `- 5K: ${formatTime(brain.best5kSec)}` : "- 5K: sin dato"}
${brain.best10kSec ? `- 10K: ${formatTime(brain.best10kSec)}` : "- 10K: sin dato"}
${brain.bestHalfSec ? `- Media maratón: ${formatTime(brain.bestHalfSec)}` : "- Media maratón: sin dato"}
${brain.bestMarathonSec ? `- Maratón: ${formatTime(brain.bestMarathonSec)}` : "- Maratón: sin dato"}

### Carga de entrenamiento (modelo Banister)
- Fitness (CTL): ${brain.ctl ? brain.ctl.toFixed(1) : "N/A"}
- Fatiga (ATL): ${brain.atl ? brain.atl.toFixed(1) : "N/A"}
- Forma (TSB): ${brain.tsb ? brain.tsb.toFixed(1) : "N/A"}
- Estado: ${getTsbStatus(brain.tsb)}
- Carga semana: ${brain.weeklyLoadKm ? brain.weeklyLoadKm.toFixed(1) : 0} km
- Carga mes: ${brain.monthlyLoadKm ? brain.monthlyLoadKm.toFixed(1) : 0} km

### VO2max estimado
- ${brain.vo2max ? `${brain.vo2max.toFixed(1)} ml/kg/min` : "Sin dato suficiente"}

### Zonas de ritmo (Daniels)
${formatPaceZones(brain)}

### Historial total
- Distancia total: ${brain.totalDistanceKm ? brain.totalDistanceKm.toFixed(0) : 0} km
- Actividades: ${brain.totalActivities ?? 0}
- Desnivel total: ${brain.totalElevationM ? brain.totalElevationM.toFixed(0) : 0} m
`
    : `
## Datos del Running Brain
Sin datos suficientes aún (sincroniza actividades para activar el Running Brain).
`;

  const activitiesSection =
    recentActivities.length > 0
      ? `
## Últimas actividades (${recentActivities.length})
${recentActivities
  .slice(0, 10)
  .map((a) => {
    const km = a.distance ? (a.distance / 1000).toFixed(2) : "?";
    const pace =
      a.distance && a.movingTime
        ? formatPace(a.movingTime / (a.distance / 1000))
        : "?";
    const date = new Date(a.startDate).toLocaleDateString("es-ES", {
      day: "2-digit",
      month: "short",
    });
    return `- ${date} · ${a.activityType} · ${km} km · ${pace} /km${a.averageHeartrate ? ` · ${Math.round(a.averageHeartrate)} ppm` : ""}`;
  })
  .join("\n")}
`
      : "\n## Últimas actividades\nSin actividades registradas aún.\n";

  return `Eres el Coach AI personal de ${name}, un entrenador de running experto y empático.

Tu rol es analizar los datos de entrenamiento del atleta y proporcionar:
- Consejos personalizados basados en su historial real
- Análisis de carga de entrenamiento (CTL/ATL/TSB)
- Recomendaciones de ritmos de entrenamiento según sus zonas
- Planes de entrenamiento adaptados a su nivel
- Consejos de recuperación y prevención de lesiones
- Motivación y seguimiento de objetivos

Habla siempre en español. Sé directo, práctico y usa los datos reales del atleta en tus respuestas. Cuando menciones ritmos, usa min:seg/km. Cuando menciones distancias, usa kilómetros.
${brainSection}
${activitiesSection}
Fecha actual: ${new Date().toLocaleDateString("es-ES", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}`;
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
  if (tsb > 10) return "Descansado / listo para competir";
  if (tsb > -10) return "Óptimo para entrenar";
  if (tsb > -30) return "Cargado / fatiga acumulada";
  return "Sobreentrenamiento — descanso necesario";
}

function formatPaceZones(brain: RunningBrain): string {
  const zones = [
    { name: "Recuperación (Z1)", value: brain.paceRecoverySec },
    { name: "Fácil (Z2)",        value: brain.paceEasySec },
    { name: "Aeróbico (Z3)",     value: brain.paceAerobicSec },
    { name: "Tempo (Z4)",        value: brain.paceTempoSec },
    { name: "Umbral (Z5)",       value: brain.paceThresholdSec },
  ];
  return zones
    .map((z) =>
      z.value ? `- ${z.name}: ${formatPace(z.value)} /km` : `- ${z.name}: sin dato`
    )
    .join("\n");
}
