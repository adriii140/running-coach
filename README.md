# Running Copilot AI

Entrenador personal inteligente basado en tus datos reales de Strava.

## Fase 1 — Lo que incluye

- Autenticación con Strava OAuth
- Sincronización manual e incremental de actividades
- Sincronización automática vía webhook de Strava
- Running Brain: récords personales, zonas de ritmo, carga de entrenamiento (CTL/ATL/TSB), VO2max estimado
- Dashboard con resumen semanal y actividades recientes
- Soporte para actividades de running, trail, fuerza y otras

---

## Requisitos previos

- Node.js 18+
- Una cuenta de Supabase (free tier)
- Una cuenta de Strava con una app registrada

---

## 1. Clonar e instalar

```bash
npm install
```

---

## 2. Configurar variables de entorno

```bash
cp .env.local.example .env.local
```

Edita `.env.local` con los valores:

### Supabase

1. Crea un proyecto en [supabase.com](https://supabase.com)
2. Ve a **Settings → Database**
3. Copia las URLs de conexión:
   - `DATABASE_URL`: Transaction pooler (puerto 6543) con `?pgbouncer=true&connection_limit=1`
   - `DIRECT_URL`: Session pooler (puerto 5432)

### Strava

1. Ve a [strava.com/settings/api](https://www.strava.com/settings/api)
2. Crea una aplicación
3. En **Authorization Callback Domain** pon `localhost` (dev) o tu dominio (prod)
4. Copia `Client ID` y `Client Secret`

### AUTH_SECRET

```bash
openssl rand -base64 32
```

### IA (opcional en Fase 1, necesario en Fase 2)

- **OpenRouter**: [openrouter.ai](https://openrouter.ai) — modelos gratuitos disponibles
- **Groq**: [console.groq.com](https://console.groq.com) — tier gratuito generoso
- **Ollama**: [ollama.ai](https://ollama.ai) para uso 100% local

---

## 3. Ejecutar migraciones

```bash
# Primera vez (crea las tablas en Supabase)
npx prisma migrate deploy

# O en desarrollo (crea la migración y aplica)
npx prisma migrate dev --name init
```

---

## 4. Iniciar en desarrollo

```bash
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000)

---

## 5. Webhook de Strava (solo producción)

El webhook permite sincronización automática al completar una actividad.
En desarrollo usa la sincronización manual desde el dashboard.

En producción (Vercel):

```bash
curl -X POST https://www.strava.com/api/v3/push_subscriptions \
  -F client_id=TU_CLIENT_ID \
  -F client_secret=TU_CLIENT_SECRET \
  -F callback_url=https://TU_DOMINIO/api/strava/webhook \
  -F verify_token=running-copilot-webhook-2024
```

---

## Estructura del proyecto

```
src/
├── app/
│   ├── (auth)/login/          # Login con Strava
│   ├── (dashboard)/           # Páginas autenticadas
│   │   ├── page.tsx           # Dashboard
│   │   ├── activities/        # Lista de actividades
│   │   ├── brain/             # Running Brain
│   │   └── settings/          # Estado de configuración
│   └── api/
│       ├── auth/[...nextauth] # Auth.js handler
│       ├── strava/sync        # Sincronización manual
│       ├── strava/webhook     # Webhook automático
│       ├── brain/recalculate  # Recalcular métricas
│       └── activities         # API REST actividades
├── lib/
│   ├── auth/config.ts         # NextAuth + Strava OAuth
│   ├── db/prisma.ts           # Cliente Prisma singleton
│   ├── strava/                # Cliente API, transformación, sync
│   └── brain/calculator.ts   # Motor Running Brain
├── components/
│   ├── dashboard/             # WeeklySummary, BrainStats, RecentActivities
│   └── shared/                # Sidebar, utilidades de formato
├── stores/                    # Estado global Zustand
└── types/                     # TypeScript types
```

---

## Scripts

```bash
npm run dev             # Desarrollo
npm run build           # Build producción
npm run start           # Servidor producción
npx prisma studio       # Explorador visual BD
npx prisma migrate dev  # Nueva migración
```

---

## Stack

| Capa | Tecnología |
|------|-----------|
| Frontend | Next.js 15, React, TypeScript, Tailwind CSS |
| UI | Shadcn/ui |
| Base de datos | PostgreSQL (Supabase free tier) |
| ORM | Prisma |
| Auth | Auth.js v5 (NextAuth) |
| Estado | Zustand |
| Gráficos | Recharts (Fase 2) |
| Mapas | Leaflet + OpenStreetMap (Fase 2) |
| IA | OpenRouter / Groq / Ollama (Fase 2) |

---

## Fase 2 (próximamente)

- Coach IA (chat con contexto completo)
- Generador de rutas con OpenRouteService + Leaflet
- Planificador de entrenamiento
- Predicciones de carrera
- Calendario personal y disponibilidad semanal
