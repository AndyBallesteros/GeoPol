import { readFile } from "node:fs/promises";

const localSignalsPath = new URL("../backend/data/signals.json", import.meta.url);
const upstreamUrl = process.env.SIGNALS_SOURCE_URL ?? process.env.EXPO_PUBLIC_SIGNALS_API_URL ?? "";

function sendJson(response, statusCode, payload) {
  response.status(statusCode).setHeader("Cache-Control", "s-maxage=900, stale-while-revalidate=3600");
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.send(JSON.stringify(payload));
}

async function readBundledSignals() {
  return JSON.parse(await readFile(localSignalsPath, "utf8"));
}

async function readUpstreamSignals() {
  if (!upstreamUrl) {
    return null;
  }

  const response = await fetch(upstreamUrl, {
    headers: {
      "user-agent": "GeoPolInteligenciaVercel/1.0",
    },
  });

  if (!response.ok) {
    throw new Error(`Upstream returned ${response.status}`);
  }

  return response.json();
}

export default async function handler(request, response) {
  if (request.method === "OPTIONS") {
    response.setHeader("Access-Control-Allow-Origin", "*");
    response.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    response.setHeader("Access-Control-Allow-Headers", "content-type");
    response.status(204).end();
    return;
  }

  if (request.method !== "GET") {
    sendJson(response, 405, { error: "method_not_allowed" });
    return;
  }

  try {
    const payload = (await readUpstreamSignals()) ?? (await readBundledSignals());
    sendJson(response, 200, payload);
  } catch (error) {
    try {
      const payload = await readBundledSignals();
      sendJson(response, 200, {
        ...payload,
        source: "bundled-fallback",
        warning: error.message,
      });
    } catch (fallbackError) {
      sendJson(response, 500, {
        error: "signals_unavailable",
        upstreamError: error.message,
        fallbackError: fallbackError.message,
      });
    }
  }
}
