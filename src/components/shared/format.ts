// Formatos de unidades para toda la app

export function formatTime(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = Math.floor(totalSeconds % 60);

  if (h > 0) {
    return `${h}h ${String(m).padStart(2, "0")}m`;
  }
  return `${m}m ${String(s).padStart(2, "0")}s`;
}

export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);

  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function formatPace(secPerKm: number): string {
  if (!secPerKm || secPerKm <= 0) return "—";
  const m = Math.floor(secPerKm / 60);
  const s = Math.floor(secPerKm % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function speedToSecPerKm(speedMs: number): number {
  if (speedMs <= 0) return 0;
  return Math.round(1000 / speedMs);
}

export function metersToKm(meters: number): string {
  return (Math.round(meters / 10) / 100).toFixed(2);
}

export function formatDistance(meters: number): string {
  if (meters >= 1000) {
    return `${(meters / 1000).toFixed(2)} km`;
  }
  return `${Math.round(meters)} m`;
}

export function formatElevation(meters: number): string {
  return `${Math.round(meters)} m`;
}

export function formatDate(date: Date | string): string {
  return new Date(date).toLocaleDateString("es-ES", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function formatRelativeDate(date: Date | string): string {
  const d = new Date(date);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Hoy";
  if (diffDays === 1) return "Ayer";
  if (diffDays < 7) return `Hace ${diffDays} días`;
  return formatDate(date);
}

export function activityTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    RUN: "Carrera",
    TRAIL_RUN: "Trail",
    VIRTUAL_RUN: "Virtual",
    STRENGTH: "Fuerza",
    CYCLING: "Ciclismo",
    SWIMMING: "Natación",
    WALKING: "Caminata",
    OTHER: "Otro",
  };
  return labels[type] ?? type;
}

export function tsbLabel(tsb: number): { label: string; color: string } {
  if (tsb > 10) return { label: "Fresco", color: "text-green-500" };
  if (tsb > -5) return { label: "Óptimo", color: "text-blue-500" };
  if (tsb > -20) return { label: "Cargado", color: "text-yellow-500" };
  return { label: "Fatigado", color: "text-red-500" };
}
