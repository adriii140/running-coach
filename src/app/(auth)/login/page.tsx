import { Activity } from "lucide-react";

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-orange-950/20 px-4">
      <div className="w-full max-w-sm space-y-6">
        {/* Logo & heading */}
        <div className="text-center">
          <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-500 to-orange-600 shadow-2xl shadow-orange-500/30 ring-1 ring-orange-500/20">
            <Activity className="h-10 w-10 text-white" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Running Copilot AI</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Tu entrenador personal inteligente para running
          </p>
        </div>

        {/* Feature list card */}
        <div className="space-y-3 rounded-2xl border border-border/40 bg-card/50 backdrop-blur-sm p-5 shadow-lg">
          {[
            { text: "Análisis de entrenamiento con IA", color: "bg-blue-500" },
            { text: "Sincronización automática con Strava", color: "bg-orange-500" },
            { text: "Planes personalizados según tus objetivos", color: "bg-green-500" },
            { text: "Generador de rutas inteligente", color: "bg-purple-500" },
          ].map((feature) => (
            <div key={feature.text} className="flex items-center gap-3 text-sm">
              <div className={`h-1.5 w-1.5 rounded-full shrink-0 ${feature.color}`} />
              <span className="text-muted-foreground">{feature.text}</span>
            </div>
          ))}
        </div>

        {/* CTA */}
        <a
          href="/api/auth/strava"
          className="flex w-full items-center justify-center gap-3 rounded-xl bg-gradient-to-r from-orange-500 to-orange-600 px-4 py-3.5 text-sm font-semibold text-white shadow-lg shadow-orange-500/25 transition-all hover:from-orange-600 hover:to-orange-700 hover:shadow-orange-500/40 active:scale-[0.98]"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current shrink-0">
            <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7 13.828h4.169" />
          </svg>
          Conectar con Strava
        </a>

        <p className="text-center text-xs text-muted-foreground">
          Al continuar aceptas que la app acceda a tus actividades de Strava de forma segura y privada.
        </p>
      </div>
    </div>
  );
}
