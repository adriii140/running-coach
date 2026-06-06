"use client";

import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from "recharts";

interface WeeklyData {
  week: string;      // "27 may"
  km: number;
  runs: number;
}

interface Props { data: WeeklyData[] }

export function WeeklyKmChart({ data }: Props) {
  const max = Math.max(...data.map((d) => d.km), 1);

  return (
    <ResponsiveContainer width="100%" height={180}>
      <BarChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
        <XAxis
          dataKey="week"
          tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v) => `${v}k`}
        />
        <Tooltip
          cursor={{ fill: "hsl(var(--muted))", opacity: 0.4 }}
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const d = payload[0].payload as WeeklyData;
            return (
              <div className="bg-background border border-border rounded-lg px-3 py-2 text-xs shadow-lg">
                <p className="font-semibold">{d.week}</p>
                <p className="text-orange-400">{d.km.toFixed(1)} km</p>
                <p className="text-muted-foreground">{d.runs} {d.runs === 1 ? "actividad" : "actividades"}</p>
              </div>
            );
          }}
        />
        <Bar dataKey="km" radius={[4, 4, 0, 0]} maxBarSize={40}>
          {data.map((entry, i) => (
            <Cell
              key={i}
              fill={entry.km >= max * 0.9 ? "hsl(var(--primary))" : entry.km >= max * 0.6 ? "#f97316" : "#f97316"}
              opacity={entry.km >= max * 0.6 ? 1 : 0.5}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
