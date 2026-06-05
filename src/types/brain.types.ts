export interface PersonalRecords {
  best1k?: { timeSec: number; date: Date };
  best3k?: { timeSec: number; date: Date };
  best5k?: { timeSec: number; date: Date };
  best10k?: { timeSec: number; date: Date };
  bestHalf?: { timeSec: number; date: Date };
  bestMarathon?: { timeSec: number; date: Date };
}

export interface PaceZones {
  recoverySec?: number;  // seg/km
  easySec?: number;
  aerobicSec?: number;
  tempoSec?: number;
  thresholdSec?: number;
  raceSec?: number;
}

export interface HeartRateZones {
  resting?: number;
  average?: number;
  max?: number;
  zone1Max?: number;
  zone2Max?: number;
  zone3Max?: number;
  zone4Max?: number;
  zone5Max?: number;
}

export interface TrainingLoad {
  ctl?: number;    // Chronic Training Load (fitness, 42d)
  atl?: number;    // Acute Training Load (fatiga, 7d)
  tsb?: number;    // Training Stress Balance
  weeklyKm?: number;
  monthlyKm?: number;
}

export interface BrainSnapshot {
  records: PersonalRecords;
  paces: PaceZones;
  heartRate: HeartRateZones;
  load: TrainingLoad;
  vo2max?: number;
  totalDistanceKm: number;
  totalActivities: number;
  updatedAt: Date;
}

export interface ActivityMetrics {
  distanceKm: number;
  durationMin: number;
  avgPaceSec: number;  // seg/km
  avgHR?: number;
  elevationM?: number;
  tss: number;         // Training Stress Score estimado
}

// Umbrales para detectar récords por distancia
export const PR_DISTANCE_WINDOWS = {
  "1k":   { minM: 950,   maxM: 1050  },
  "3k":   { minM: 2900,  maxM: 3100  },
  "5k":   { minM: 4800,  maxM: 5200  },
  "10k":  { minM: 9700,  maxM: 10300 },
  "half": { minM: 20800, maxM: 21500 },
  "marathon": { minM: 42000, maxM: 43000 },
} as const;
