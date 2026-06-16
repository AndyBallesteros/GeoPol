import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { ingest } from "./ingest.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataPath = join(__dirname, "..", "data", "signals.json");
const port = Number(process.env.PORT ?? 8787);
const host = process.env.HOST ?? "0.0.0.0";
const refreshIntervalMinutes = Number(process.env.REFRESH_INTERVAL_MINUTES ?? 360);
const refreshIntervalMs = refreshIntervalMinutes * 60 * 1000;
let refreshPromise = null;

async function refreshSignals() {
  if (!refreshPromise) {
    refreshPromise = ingest().finally(() => {
      refreshPromise = null;
    });
  }

  return refreshPromise;
}

async function readSignalsFile() {
  return JSON.parse(await readFile(dataPath, "utf8"));
}

async function readSignals() {
  try {
    const payload = await readSignalsFile();
    const fileInfo = await stat(dataPath);
    const isStale = Date.now() - fileInfo.mtimeMs >= refreshIntervalMs;

    if (!isStale) {
      return payload;
    }

    try {
      return await refreshSignals();
    } catch {
      return payload;
    }
  } catch {
    return await refreshSignals();
  }
}

function sendJson(response, status, payload) {
  response.writeHead(status, {
    "access-control-allow-origin": "*",
    "content-type": "application/json; charset=utf-8",
  });
  response.end(JSON.stringify(payload));
}

createServer(async (request, response) => {
  try {
    if (request.method === "OPTIONS") {
      response.writeHead(204, {
        "access-control-allow-origin": "*",
        "access-control-allow-methods": "GET, OPTIONS",
        "access-control-allow-headers": "content-type",
      });
      response.end();
      return;
    }

    if (request.url === "/health") {
      sendJson(response, 200, {
        ok: true,
        service: "geopol-inteligencia-api",
        refreshIntervalMinutes,
      });
      return;
    }

    if (request.url === "/signals") {
      sendJson(response, 200, await readSignals());
      return;
    }

    sendJson(response, 404, { error: "not_found" });
  } catch (error) {
    sendJson(response, 500, { error: error.message });
  }
}).listen(port, host, () => {
  console.log(`GeoPol API listening on http://${host}:${port}`);
});
