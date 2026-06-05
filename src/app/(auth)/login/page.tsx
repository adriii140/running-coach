import { signIn } from "@/../auth";
import { Activity } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-full max-w-sm space-y-8 px-6">
        {/* Logo */}
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary">
            <Activity className="h-8 w-8 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold">Running Copilot AI</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Tu entrenador personal inteligente
          </p>
        </div>

        {/* Características */}
        <div className="space-y-3 rounded-xl border border-border/50 bg-card p-4">
          {[
            "Análisis de entrenamiento con IA",
            "Sincronización automática con Strava",
            "Planes personalizados según tus objetivos",
            "Generador de rutas inteligente",
          ].map((feature) => (
            <div key={feature} className="flex items-center gap-2 text-sm">
              <div className="h-1.5 w-1.5 rounded-full bg-primary" />
              <span className="text-muted-foreground">{feature}</span>
            </div>
          ))}
        </div>

        {/* Login */}
        <form
          action={async () => {
            "use server";
            await signIn("strava", { redirectTo: "/" });
          }}
        >
          <Button type="submit" className="w-full gap-3" size="lg">
            <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current">
              <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7 13.828h4.169" />
            </svg>
            Conectar con Strava
          </Button>
        </form>

        <p className="text-center text-xs text-muted-foreground">
          Al continuar aceptas que la app acceda a tus actividades de Strava
          de forma segura y privada.
        </p>
      </div>
    </div>
  );
}
