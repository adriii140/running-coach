import { create } from "zustand";

type SyncStatus = "idle" | "syncing" | "success" | "error";

interface SyncStore {
  status: SyncStatus;
  message: string;
  lastSync: Date | null;
  sync: (type?: "full" | "incremental") => Promise<void>;
}

export const useSyncStore = create<SyncStore>((set) => ({
  status: "idle",
  message: "",
  lastSync: null,

  sync: async (type = "incremental") => {
    set({ status: "syncing", message: "Sincronizando con Strava..." });

    try {
      const res = await fetch(`/api/strava/sync?type=${type}`, {
        method: "POST",
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error ?? "Error desconocido");

      set({
        status: "success",
        message: data.message,
        lastSync: new Date(),
      });
    } catch (err) {
      set({
        status: "error",
        message: err instanceof Error ? err.message : "Error al sincronizar",
      });
    }

    // Limpiar estado tras 5 segundos
    setTimeout(() => set({ status: "idle", message: "" }), 5000);
  },
}));
