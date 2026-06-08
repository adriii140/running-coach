"use client";

import { RefreshCw, CheckCircle, XCircle } from "lucide-react";
import { useSyncStore } from "@/stores/sync.store";
import { useBrainStore } from "@/stores/brain.store";
import { cn } from "@/lib/utils";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

export function SyncButton() {
  const { status, message, sync } = useSyncStore();
  const { recalculate } = useBrainStore();
  const router = useRouter();
  const pressStartRef = useRef(false);
  const [longPressTimer, setLongPressTimer] = useState<ReturnType<typeof setTimeout> | null>(null);

  const isSyncing = status === "syncing";

  const handleSync = async (type: "incremental" | "full") => {
    await sync(type);
    await recalculate();
    // Refrescar datos del servidor (SSR pages) para mostrar cambios inmediatamente
    router.refresh();
  };

  // Long press (700ms) → full sync; short tap → incremental
  const longFiredRef = useRef(false);

  const handlePressStart = () => {
    pressStartRef.current = true;
    longFiredRef.current = false;
    const t = setTimeout(() => {
      if (pressStartRef.current) {
        longFiredRef.current = true;
        handleSync("full");
      }
    }, 700);
    setLongPressTimer(t);
  };

  const handlePressEnd = () => {
    pressStartRef.current = false;
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      setLongPressTimer(null);
    }
  };

  // Touch-specific: prevent ghost click and handle short tap manually
  const handleTouchStart = (e: React.TouchEvent) => {
    e.preventDefault(); // prevent ghost click
    handlePressStart();
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    e.preventDefault();
    handlePressEnd();
    // Short tap: trigger incremental sync if long press didn't fire
    if (!longFiredRef.current && !isSyncing) {
      handleSync("incremental");
    }
  };

  const StatusIcon = status === "success"
    ? CheckCircle
    : status === "error"
    ? XCircle
    : RefreshCw;

  const iconClass = status === "success"
    ? "text-green-500"
    : status === "error"
    ? "text-red-500"
    : isSyncing
    ? "animate-spin text-muted-foreground"
    : "text-muted-foreground";

  return (
    <div className="flex items-center gap-2">
      {message && (
        <span className="text-xs text-muted-foreground max-w-[160px] sm:max-w-[200px] truncate">
          {message}
        </span>
      )}

      {/* Tap = incremental sync · Long press = full sync */}
      <button
        onClick={() => handleSync("incremental")}
        onMouseDown={handlePressStart}
        onMouseUp={handlePressEnd}
        onMouseLeave={handlePressEnd}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        disabled={isSyncing}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 h-8 text-xs font-medium transition-colors",
          "hover:bg-muted hover:text-foreground active:scale-95",
          "disabled:pointer-events-none disabled:opacity-50"
        )}
        title="Sincronizar Strava · Mantén pulsado para sincronización completa"
      >
        <StatusIcon className={cn("h-3.5 w-3.5", iconClass)} />
        <span>{isSyncing ? "Sincronizando..." : "Sync"}</span>
      </button>
    </div>
  );
}
