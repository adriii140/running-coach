"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Settings2, CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";

interface ThresholdOverrideProps {
  currentThresholdSec: number | null;
}

function formatPaceSec(sec: number | null): string {
  if (!sec) return "";
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function parsePaceInput(value: string): number | null {
  // Acepta formatos: "6:30", "630", "6.5"
  const trimmed = value.trim();
  const colonMatch = trimmed.match(/^(\d+):(\d{1,2})$/);
  if (colonMatch) {
    const m = parseInt(colonMatch[1]);
    const s = parseInt(colonMatch[2]);
    if (s >= 60) return null;
    return m * 60 + s;
  }
  const numMatch = trimmed.match(/^(\d+)$/);
  if (numMatch) {
    const val = parseInt(numMatch[1]);
    // Si es >10, probablemente son segundos totales (e.g. "390" = 6:30)
    if (val > 10) return val;
  }
  return null;
}

export function ThresholdOverride({ currentThresholdSec }: ThresholdOverrideProps) {
  const [input, setInput] = useState(formatPaceSec(currentThresholdSec));
  const [status, setStatus] = useState<"idle" | "saving" | "ok" | "error">("idle");
  const [error, setError] = useState("");
  const router = useRouter();

  const handleSave = async () => {
    const sec = parsePaceInput(input);
    if (!sec || sec < 180 || sec > 900) {
      setError("Formato inválido. Usa M:SS (ej: 6:30). Rango: 3:00–15:00");
      return;
    }
    setError("");
    setStatus("saving");
    try {
      const res = await fetch("/api/brain/threshold", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ thresholdSec: sec }),
      });
      if (!res.ok) throw new Error("Error al guardar");
      setStatus("ok");
      // Refrescar página para mostrar nuevas zonas
      setTimeout(() => {
        router.refresh();
        setStatus("idle");
      }, 1200);
    } catch {
      setStatus("error");
      setError("No se pudo guardar. Inténtalo de nuevo.");
    }
  };

  return (
    <Card className="border-border/40 bg-card/50 backdrop-blur-sm">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Settings2 className="h-4 w-4 text-muted-foreground" />
          Ritmo umbral manual
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">
          Si conoces tu ritmo umbral real (p.ej. de Strava o un test de umbral), introdúcelo aquí para calibrar las zonas de ritmo.
        </p>
        <div className="flex gap-2 items-center">
          <div className="relative">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="6:30"
              className="w-24 rounded-lg border border-border bg-background px-3 py-1.5 text-sm font-mono text-center outline-none focus:border-orange-500/60 transition-colors"
            />
          </div>
          <span className="text-xs text-muted-foreground">/km</span>
          <button
            onClick={handleSave}
            disabled={status === "saving"}
            className="flex items-center gap-1.5 rounded-lg bg-orange-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-orange-600 disabled:opacity-50 transition-colors"
          >
            {status === "saving" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : status === "ok" ? (
              <CheckCircle className="h-3.5 w-3.5" />
            ) : (
              "Guardar y recalcular"
            )}
          </button>
        </div>
        {error && (
          <div className="flex items-center gap-1.5 text-xs text-destructive">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            {error}
          </div>
        )}
        <p className="text-xs text-muted-foreground/50">
          Tip: en Strava → Rendimiento → Zonas de ritmo → Umbral de velocidad
        </p>
      </CardContent>
    </Card>
  );
}
