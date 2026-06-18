# GeoPol Inteligencia: actualizacion automatica

## Flujo

1. `backend/src/sources.js` define fuentes RSS por pais y reglas editoriales por URL.
2. `npm run ingest` descarga feeds, normaliza titulares, excluye ruido no politico, deduplica y puntua senales.
3. El resultado operativo se escribe en `backend/data/signals.json`.
4. El historico acumulado se guarda en `backend/data/signals-archive.json`.
5. La ingesta genera tambien `briefings` y `stats` para la app.
6. `npm start` dentro de `backend/` expone `GET /signals` y `GET /archive`.
7. El backend refresca automaticamente la cache si `signals.json` supera `REFRESH_INTERVAL_MINUTES` sin actualizarse.
8. La app Expo usa `EXPO_PUBLIC_SIGNALS_API_URL` o `EXPO_PUBLIC_SIGNALS_API_BASE_URL` para consumir ese endpoint.
9. GitHub Actions ejecuta la ingesta cada 6 horas y puede versionar el JSON generado.

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

## Produccion

Para produccion conviene desplegar `backend/src/server.js` en Render. El servicio debe exponer:

- `GET /health`
- `GET /signals`
- `GET /archive`

En Expo configura:

```text
EXPO_PUBLIC_SIGNALS_API_URL=https://tu-api.onrender.com/signals
```

Tambien puedes usar:

```text
EXPO_PUBLIC_SIGNALS_API_BASE_URL=https://tu-api.onrender.com
```

Variables utiles del backend:

```text
HOST=0.0.0.0
PORT=8787
REFRESH_INTERVAL_MINUTES=360
```

Con esta configuracion, el refresco automatico queda asi:

- GitHub Actions genera un `signals.json` nuevo cada 6 horas.
- Si Render redepliega con cada push, la API servira ese JSON actualizado.
- Ademas, si el archivo queda viejo, el propio backend intentara regenerarlo en la siguiente peticion a `/signals`.
- El historico se conserva entre ingestas y registra `firstSeenAt`, `lastSeenAt` y `seenCount`.

## Limites editoriales y legales

La ingesta guarda metadatos: titulo, resumen, fecha, pais, fuente, tema, prioridad, score politico y URL.
No debe republicar articulos completos. La app enlaza al medio original.
