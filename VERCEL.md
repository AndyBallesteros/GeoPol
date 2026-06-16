# Despliegue en Vercel

## Qué queda desplegado

- El frontend web de Expo se compila con `npm run build:web`.
- Vercel sirve los estáticos desde `dist/`.
- Las rutas `api/health` y `api/signals` se publican como Vercel Functions.

## Comportamiento de la API en Vercel

`/api/signals` intenta usar esta prioridad:

1. `SIGNALS_SOURCE_URL`
2. `EXPO_PUBLIC_SIGNALS_API_URL`
3. `backend/data/signals.json` empaquetado en el despliegue

Esto permite dos modos:

- Recomendado: Vercel para frontend y proxy de API, con Render como origen real de señales.
- Respaldo: si el origen externo falla, Vercel devuelve el JSON incluido en el despliegue.

## Variables recomendadas en Vercel

```text
EXPO_PUBLIC_SIGNALS_API_URL=/api/signals
SIGNALS_SOURCE_URL=https://tu-backend-real.onrender.com/signals
```

## Configuración en Vercel

1. Importa el repositorio.
2. Framework Preset: `Other`.
3. Build Command: `npm run build:web`
4. Output Directory: `dist`
5. Añade las variables de entorno anteriores.

## Comprobaciones tras desplegar

- `https://tu-proyecto.vercel.app/api/health`
- `https://tu-proyecto.vercel.app/api/signals`
- `https://tu-proyecto.vercel.app/`
