"use client";

import { RefreshCw, CheckCircle, XCircle, Download } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useSyncStore } from "@/stores/sync.store";
import { useBrainStore } from "@/stores/brain.store";
import { cn } from "@/lib/utils";

export function SyncButton() {
  const { status, message, sync } = useSyncStore();
  const { recalculate } = useBrainStore();

  const isSyncing = status === "syncing";

  const handleSync = async (type: "incremental" | "full") => {
    await sync(type);
    await recalculate();
  };

  return (
    <div className="flex items-center gap-2">
      {message && (
        <span className="text-xs text-muted-foreground max-w-[200px] truncate">
          {message}
        </span>
      )}

      <DropdownMenu>
        <DropdownMenuTrigger
          disabled={isSyncing}
          className={cn(
            "inline-flex items-center gap-2 rounded-lg border border-border bg-background px-2.5 h-7 text-[0.8rem] font-medium transition-colors",
            "hover:bg-muted hover:text-foreground",
            "disabled:pointer-events-none disabled:opacity-50"
          )}
        >
          {status === "success" ? (
            <CheckCircle className="h-4 w-4 text-green-500" />
          ) : status === "error" ? (
            <XCircle className="h-4 w-4 text-red-500" />
          ) : (
            <RefreshCw className={cn("h-4 w-4", isSyncing && "animate-spin")} />
          )}
          {isSyncing ? "Sincronizando..." : "Sincronizar"}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => handleSync("incremental")}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Incremental (nuevas)
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleSync("full")}>
            <Download className="mr-2 h-4 w-4" />
            Completa (todo el historial)
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
