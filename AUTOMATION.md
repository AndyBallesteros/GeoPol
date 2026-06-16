# GeoPol Inteligencia: actualización automática

## Flujo

1. `backend/src/sources.js` define fuentes RSS por país.
2. `npm run ingest` descarga feeds, normaliza titulares, deduplica y clasifica señales.
3. El resultado se escribe en `backend/data/signals.json`.
4. `npm start` dentro de `backend/` expone `GET /signals`.
5. La app Expo usa `EXPO_PUBLIC_SIGNALS_API_URL` o `EXPO_PUBLIC_SIGNALS_API_BASE_URL` para consumir ese endpoint.
6. GitHub Actions ejecuta la ingesta cada 6 horas y puede versionar el JSON generado.

## Desarrollo local

```powershell
cd backend
npm install
npm run ingest
npm start
```

En otra terminal:

```powershell
$env:EXPO_PUBLIC_SIGNALS_API_URL="http://192.168.0.17:8787/signals"
npm start -- --lan --port 8081
```

## Producción

Para producción conviene desplegar `backend/src/server.js` en Render. El servicio debe exponer:

- `GET /health`
- `GET /signals`

En Expo configura:

```text
EXPO_PUBLIC_SIGNALS_API_URL=https://tu-api.onrender.com/signals
```

También puedes usar:

```text
EXPO_PUBLIC_SIGNALS_API_BASE_URL=https://tu-api.onrender.com
```

## Límites editoriales y legales

La ingesta guarda metadatos: título, resumen, fecha, país, fuente, tema, prioridad y URL.
No debe republicar artículos completos. La app enlaza al medio original.
