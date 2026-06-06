"use client";

import {
  ScatterChart, Scatter, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from "recharts";
import type { ScatterShapeProps } from "recharts";

interface PacePoint {
  date: string;
  km: number;
  paceSec: number;  // segundos por km
  label: string;
}

interface Props { data: PacePoint[] }

function formatPace(sec: number) {
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function PaceChart({ data }: Props) {
  return (
    <ResponsiveContainer width="100%" height={180}>
      <ScatterChart margin={{ top: 4, right: 4, left: -10, bottom: 0 }}>
        <XAxis
          dataKey="date"
          type="category"
          tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
          axisLine={false}
          tickLine={false}
          interval="preserveStartEnd"
        />
        <YAxis
          dataKey="paceSec"
          type="number"
          reversed
          tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
          axisLine={false}
          tickLine={false}
          tickFormatter={formatPace}
          domain={["auto", "auto"]}
        />
        <Tooltip
          cursor={{ strokeDasharray: "3 3" }}
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const d = payload[0].payload as PacePoint;
            return (
              <div className="bg-background border border-border rounded-lg px-3 py-2 text-xs shadow-lg">
                <p className="font-semibold">{d.label}</p>
                <p className="text-orange-400">{formatPace(d.paceSec)} /km</p>
                <p className="text-muted-foreground">{d.km.toFixed(1)} km</p>
              </div>
            );
          }}
        />
        <Scatter
          data={data}
          fill="#f97316"
          opacity={0.8}
          shape={(props: ScatterShapeProps) => {
            const cx = (props.cx as number) ?? 0;
            const cy = (props.cy as number) ?? 0;
            const payload = props.payload as PacePoint | undefined;
            const r = Math.max(3, Math.min(10, (payload?.km ?? 0) / 2));
            return <circle cx={cx} cy={cy} r={r} fill="#f97316" opacity={0.7} />;
          }}
        />
      </ScatterChart>
    </ResponsiveContainer>
  );
}
