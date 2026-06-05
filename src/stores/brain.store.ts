import { create } from "zustand";
import type { RunningBrain } from "@prisma/client";

interface BrainStore {
  brain: RunningBrain | null;
  isLoading: boolean;
  lastFetched: Date | null;
  setBrain: (brain: RunningBrain | null) => void;
  fetchBrain: () => Promise<void>;
  recalculate: () => Promise<void>;
}

export const useBrainStore = create<BrainStore>((set, get) => ({
  brain: null,
  isLoading: false,
  lastFetched: null,

  setBrain: (brain) => set({ brain }),

  fetchBrain: async () => {
    const { lastFetched, isLoading } = get();

    // Cache de 5 minutos
    if (isLoading) return;
    if (lastFetched && Date.now() - lastFetched.getTime() < 5 * 60 * 1000) return;

    set({ isLoading: true });
    try {
      const res = await fetch("/api/brain");
      if (res.ok) {
        const brain = await res.json();
        set({ brain, lastFetched: new Date() });
      }
    } finally {
      set({ isLoading: false });
    }
  },

  recalculate: async () => {
    set({ isLoading: true });
    try {
      await fetch("/api/brain/recalculate", { method: "POST" });
      // Forzar recarga
      set({ lastFetched: null });
      await get().fetchBrain();
    } finally {
      set({ isLoading: false });
    }
  },
}));
