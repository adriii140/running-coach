import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import dynamic from "next/dynamic";

const RouteGeneratorMap = dynamic(
  () => import("@/components/routes/RouteGeneratorMap").then((m) => m.RouteGeneratorMap),
  { ssr: false, loading: () => <div className="h-[calc(100vh-10rem)] bg-muted/30 rounded-xl animate-pulse" /> }
);

export default async function RoutesPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const hasORS = !!process.env.OPENROUTESERVICE_API_KEY;

  return (
    <div className="space-y-4 h-full">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">Generador de rutas</h1>
          <p className="text-sm text-muted-foreground mt-1">
            El Coach AI analiza tu forma y genera la ruta perfecta para hoy
          </p>
        </div>
        {!hasORS && (
          <a
            href="https://openrouteservice.org/dev/#/signup"
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 text-xs px-3 py-1.5 rounded-lg bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/20 transition-colors"
          >
            ⚠ Configura ORS API key
          </a>
        )}
      </div>
      <RouteGeneratorMap />
    </div>
  );
}
