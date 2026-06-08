"use client";

import dynamic from "next/dynamic";

const RouteGeneratorMapDynamic = dynamic(
  () => import("@/components/routes/RouteGeneratorMap").then((m) => m.RouteGeneratorMap),
  {
    ssr: false,
    loading: () => (
      <div className="h-[calc(100vh-10rem)] bg-muted/30 rounded-xl animate-pulse" />
    ),
  }
);

interface Props {
  lastRunLat?: number | null;
  lastRunLng?: number | null;
}

export function RouteGeneratorMapLoader({ lastRunLat, lastRunLng }: Props) {
  return <RouteGeneratorMapDynamic lastRunLat={lastRunLat} lastRunLng={lastRunLng} />;
}
