import { signals as fallbackSignals } from "./data.js";

const rawApiUrl = process.env.EXPO_PUBLIC_SIGNALS_API_URL ?? process.env.EXPO_PUBLIC_SIGNALS_API_BASE_URL ?? "";
const API_URL = rawApiUrl
  ? rawApiUrl.replace(/\/+$/, "").endsWith("/signals")
    ? rawApiUrl.replace(/\/+$/, "")
    : `${rawApiUrl.replace(/\/+$/, "")}/signals`
  : "";

export async function loadSignals() {
  if (!API_URL) {
    return {
      generatedAt: null,
      signals: fallbackSignals,
      source: "fallback",
    };
  }

  const response = await fetch(API_URL);

  if (!response.ok) {
    throw new Error(`Signals API returned ${response.status}`);
  }

  const payload = await response.json();

  return {
    generatedAt: payload.generatedAt ?? null,
    signals: Array.isArray(payload.signals) ? payload.signals : fallbackSignals,
    source: "api",
  };
}
