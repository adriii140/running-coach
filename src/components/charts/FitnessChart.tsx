"use client";

import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  ReferenceLine, Legend,
} from "recharts";

interface FitnessPoint {
  date: string;   // "27 may"
  ctl: number;    // Fitness
  atl: number;    // Fatiga
  tsb: number;    // Forma
}

interface Props { data: FitnessPoint[] }

export function FitnessChart({ data }: Props) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
        <XAxis
          dataKey="date"
          tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
          axisLine={false}
          tickLine={false}
          interval="preserveStartEnd"
        />
        <YAxis
          tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
          axisLine={false}
          tickLine={false}
        />
        <ReferenceLine y={0} stroke="hsl(var(--border))" strokeDasharray="3 3" />
        <Tooltip
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const d = payload[0].payload as FitnessPoint;
            return (
              <div className="bg-background border border-border rounded-lg px-3 py-2 text-xs shadow-lg space-y-1">
                <p className="font-semibold mb-1">{d.date}</p>
                <p className="text-blue-400">Fitness (CTL): {d.ctl.toFixed(1)}</p>
                <p className="text-red-400">Fatiga (ATL): {d.atl.toFixed(1)}</p>
                <p style={{ color: d.tsb >= 0 ? "#22c55e" : "#f97316" }}>
                  Forma (TSB): {d.tsb > 0 ? "+" : ""}{d.tsb.toFixed(1)}
                </p>
              </div>
            );
          }}
        />
        <Legend
          formatter={(value) =>
            value === "ctl" ? "Fitness" : value === "atl" ? "Fatiga" : "Forma"
          }
          wrapperStyle={{ fontSize: 11 }}
        />
        <Line type="monotone" dataKey="ctl" stroke="#60a5fa" strokeWidth={2} dot={false} name="ctl" />
        <Line type="monotone" dataKey="atl" stroke="#f87171" strokeWidth={2} dot={false} name="atl" />
        <Line type="monotone" dataKey="tsb" stroke="#4ade80" strokeWidth={2} dot={false} name="tsb" />
      </LineChart>
    </ResponsiveContainer>
  );
}
