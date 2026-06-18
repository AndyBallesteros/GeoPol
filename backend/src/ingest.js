import { XMLParser } from "fast-xml-parser";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { sources } from "./sources.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outputPath = join(__dirname, "..", "data", "signals.json");
const archivePath = join(__dirname, "..", "data", "signals-archive.json");
const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "",
  textNodeName: "text",
});

const sourceTypeWeights = {
  Investigacion: 3,
  Analisis: 2,
  Politica: 2,
  Generalista: 0,
  Digital: 1,
};

const politicalSignals = [
  { term: "presidente", weight: 3 },
  { term: "gobierno", weight: 3 },
  { term: "congreso", weight: 3 },
  { term: "senado", weight: 3 },
  { term: "diputado", weight: 2 },
  { term: "diputados", weight: 2 },
  { term: "senador", weight: 2 },
  { term: "senadores", weight: 2 },
  { term: "ministro", weight: 2 },
  { term: "ministerio", weight: 2 },
  { term: "oposicion", weight: 2 },
  { term: "oficialismo", weight: 2 },
  { term: "tribunal", weight: 2 },
  { term: "corte", weight: 2 },
  { term: "fiscalia", weight: 2 },
  { term: "fiscal", weight: 2 },
  { term: "juez", weight: 2 },
  { term: "justicia", weight: 2 },
  { term: "eleccion", weight: 3 },
  { term: "elecciones", weight: 3 },
  { term: "electoral", weight: 3 },
  { term: "campana", weight: 2 },
  { term: "voto", weight: 2 },
  { term: "reforma", weight: 2 },
  { term: "decreto", weight: 2 },
  { term: "ley", weight: 2 },
  { term: "corrupcion", weight: 3 },
  { term: "seguridad", weight: 2 },
  { term: "violencia", weight: 2 },
  { term: "protesta", weight: 2 },
  { term: "diplomacia", weight: 2 },
  { term: "sanciones", weight: 2 },
  { term: "migracion", weight: 2 },
  { term: "inflacion", weight: 1 },
  { term: "deuda", weight: 1 },
  { term: "presupuesto", weight: 1 },
  { term: "impuesto", weight: 1 },
  { term: "banco central", weight: 1 },
  { term: "estado", weight: 1 },
];

const highPriorityTerms = [
  "crisis",
  "eleccion",
  "elecciones",
  "congreso",
  "corrupcion",
  "fiscalia",
  "corte",
  "seguridad",
  "violencia",
  "sanciones",
  "gobierno",
  "reforma",
  "protesta",
  "militar",
  "presidente",
];

const blockedTerms = [
  "mundial",
  "partido",
  "goles",
  "gol",
  "seleccion",
  "telefe",
  "tv publica",
  "canales tv",
  "donde ver",
  "en vivo",
  "alineaciones",
  "horarios",
  "futbol",
  "copa del mundo",
  "deporte",
  "liga",
  "tenis",
  "baloncesto",
  "nba",
  "champions",
  "streaming",
  "serie",
  "celebridad",
  "famoso",
  "humor",
  "receta",
  "horoscopo",
];

const stopWords = new Set([
  "a",
  "al",
  "ante",
  "bajo",
  "como",
  "con",
  "contra",
  "de",
  "del",
  "desde",
  "el",
  "en",
  "entre",
  "esta",
  "este",
  "hoy",
  "la",
  "las",
  "lo",
  "los",
  "mas",
  "para",
  "por",
  "que",
  "se",
  "sin",
  "sobre",
  "tras",
  "una",
  "uno",
  "un",
  "y",
]);

function normalizeText(value) {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function normalizeArray(value) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function textFrom(value) {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  if (typeof value === "object") return value.text ?? value["#text"] ?? "";
  return "";
}

function stripHtml(value) {
  return textFrom(value)
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function linkFrom(item) {
  if (!item.link) return item.guid?.text ?? item.guid ?? "";
  if (typeof item.link === "string") return item.link;
  if (Array.isArray(item.link)) {
    const alternate = item.link.find((link) => link.rel === "alternate") ?? item.link[0];
    return alternate.href ?? textFrom(alternate);
  }
  return item.link.href ?? textFrom(item.link);
}

function topicFor(source, haystack) {
  if (haystack.match(/seguridad|violencia|crimen|militar|narcotrafico/)) return "Seguridad";
  if (haystack.match(/elecci|campana|voto|encuesta/)) return "Elecciones";
  if (haystack.match(/econom|fiscal|presupuesto|deuda|inflacion|impuesto|banco central/)) return "Economia politica";
  if (haystack.match(/corrup|fiscalia|tribunal|corte|justicia/)) return "Instituciones";
  if (haystack.match(/sancion|diplom|frontera|migraci/)) return "Diplomacia";
  return source.defaultTopic;
}

function priorityFor(haystack, politicalScore) {
  const score = highPriorityTerms.reduce((total, term) => total + (haystack.includes(term) ? 1 : 0), 0);
  return score >= 2 || politicalScore >= 7 ? "Alta" : "Media";
}

function politicalScoreFor(source, haystack, url) {
  let score = sourceTypeWeights[source.type] ?? 0;

  for (const signal of politicalSignals) {
    if (haystack.includes(signal.term)) {
      score += signal.weight;
    }
  }

  if (url.includes("/politica/")) score += 4;
  if (url.includes("/elecciones/")) score += 4;
  if (url.includes("/opinion/")) score += 1;
  if (url.includes("/economia/")) score += 1;

  return score;
}

function matchesAnyPattern(value, patterns = []) {
  return patterns.some((pattern) => value.includes(normalizeText(pattern)));
}

function exclusionReason(source, haystack, url) {
  if (matchesAnyPattern(url, source.blockUrlPatterns)) {
    return "blocked_url_pattern";
  }

  if (source.allowUrlPatterns?.length && !matchesAnyPattern(url, source.allowUrlPatterns)) {
    return "outside_allowed_sections";
  }

  const blockedTerm = blockedTerms.find((term) => haystack.includes(term));
  if (blockedTerm) {
    return `blocked_term:${blockedTerm}`;
  }

  return null;
}

function eventKeyFor(signal) {
  const rawTokens = normalizeText(`${signal.country} ${signal.topic} ${signal.title}`)
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .filter((token) => token.length > 3 && !stopWords.has(token));

  const topicToken = normalizeText(signal.topic).replace(/[^a-z0-9]+/g, "-");
  const core = [...new Set(rawTokens)].slice(0, 4).join("-");
  return `${normalizeText(signal.country)}-${topicToken}-${core || "evento"}`;
}

function scoreSignals(a, b) {
  const priorityOrder = { Alta: 2, Media: 1 };
  const byPriority = (priorityOrder[b.priority] ?? 0) - (priorityOrder[a.priority] ?? 0);
  if (byPriority !== 0) return byPriority;

  const byScore = (b.politicalScore ?? 0) - (a.politicalScore ?? 0);
  if (byScore !== 0) return byScore;

  return new Date(b.publishedAt ?? 0) - new Date(a.publishedAt ?? 0);
}

function toSignal(source, item) {
  const title = stripHtml(item.title);
  const summary = stripHtml(item.description ?? item.summary ?? item["content:encoded"]).slice(0, 260);
  const url = linkFrom(item) || source.siteUrl;
  const publishedAt = item.pubDate ?? item.published ?? item.updated ?? item["dc:date"] ?? null;
  const haystack = normalizeText(`${title} ${summary}`);
  const normalizedUrl = normalizeText(url);
  const reason = exclusionReason(source, haystack, normalizedUrl);

  if (reason) {
    return null;
  }

  const politicalScore = politicalScoreFor(source, haystack, normalizedUrl);
  const minimumScore = source.minimumPoliticalScore ?? (source.type === "Generalista" ? 4 : 3);

  if (politicalScore < minimumScore) {
    return null;
  }

  const signal = {
    id: createHash("sha256").update(`${source.id}:${url || title}`).digest("hex").slice(0, 16),
    country: source.country,
    source: source.name,
    sourceType: source.type,
    topic: topicFor(source, haystack),
    priority: priorityFor(haystack, politicalScore),
    title,
    summary: summary || `Ultima actualizacion de ${source.name}.`,
    url,
    publishedAt,
    politicalScore,
  };

  return {
    ...signal,
    eventKey: eventKeyFor(signal),
  };
}

async function fetchSource(source) {
  const response = await fetch(source.feedUrl, {
    headers: {
      "user-agent": "GeoPolInteligenciaBot/0.3 (+https://github.com/AndyBallesteros/GeoPol-Inteligencia)",
    },
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`);
  }

  const xml = await response.text();
  const parsed = parser.parse(xml);
  const channel = parsed.rss?.channel;
  const rssItems = normalizeArray(channel?.item);
  const atomItems = normalizeArray(parsed.feed?.entry);
  const maxItems = source.maxItems ?? 12;

  return [...rssItems, ...atomItems]
    .slice(0, maxItems)
    .map((item) => toSignal(source, item))
    .filter(Boolean);
}

async function readArchiveSignals() {
  try {
    const payload = JSON.parse(await readFile(archivePath, "utf8"));
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload.signals)) return payload.signals;
    return [];
  } catch {
    return [];
  }
}

function mergeArchiveSignals(currentSignals, archiveSignals, generatedAt) {
  const archiveById = new Map(archiveSignals.map((signal) => [signal.id, signal]));

  for (const signal of currentSignals) {
    const existing = archiveById.get(signal.id);
    if (!existing) {
      archiveById.set(signal.id, {
        ...signal,
        firstSeenAt: generatedAt,
        lastSeenAt: generatedAt,
        seenCount: 1,
      });
      continue;
    }

    archiveById.set(signal.id, {
      ...existing,
      ...signal,
      firstSeenAt: existing.firstSeenAt ?? generatedAt,
      lastSeenAt: generatedAt,
      seenCount: (existing.seenCount ?? 1) + 1,
    });
  }

  const merged = [...archiveById.values()].sort((a, b) => {
    const bySeen = new Date(b.lastSeenAt ?? 0) - new Date(a.lastSeenAt ?? 0);
    if (bySeen !== 0) return bySeen;
    return scoreSignals(a, b);
  });

  const trimmed = merged.slice(0, 5000);
  const archiveLookup = new Map(trimmed.map((signal) => [signal.id, signal]));
  const enrichedCurrent = currentSignals.map((signal) => ({
    ...signal,
    firstSeenAt: archiveLookup.get(signal.id)?.firstSeenAt ?? generatedAt,
    lastSeenAt: archiveLookup.get(signal.id)?.lastSeenAt ?? generatedAt,
    seenCount: archiveLookup.get(signal.id)?.seenCount ?? 1,
  }));

  return {
    archiveSignals: trimmed,
    currentSignals: enrichedCurrent,
  };
}

function buildBriefings(signals) {
  const grouped = new Map();

  for (const signal of signals) {
    if (!grouped.has(signal.country)) {
      grouped.set(signal.country, []);
    }
    grouped.get(signal.country).push(signal);
  }

  return [...grouped.entries()]
    .map(([country, countrySignals]) => {
      const sorted = [...countrySignals].sort(scoreSignals);
      const topSignals = sorted.slice(0, 3);
      const focusTopics = [...new Set(topSignals.map((signal) => signal.topic))].slice(0, 3);
      const topSources = [...new Set(topSignals.map((signal) => signal.source))].slice(0, 3);
      const lead = topSignals[0];
      const priority = topSignals.some((signal) => signal.priority === "Alta") ? "Alta" : "Media";

      return {
        country,
        priority,
        leadTitle: lead.title,
        leadUrl: lead.url,
        focusTopics,
        topSources,
        signalCount: countrySignals.length,
        summary: `Foco en ${focusTopics.join(", ")}. Vigilar ${topSignals
          .slice(0, 2)
          .map((signal) => signal.source)
          .join(" y ")}.`,
      };
    })
    .sort((a, b) => {
      const priorityOrder = { Alta: 2, Media: 1 };
      const byPriority = (priorityOrder[b.priority] ?? 0) - (priorityOrder[a.priority] ?? 0);
      if (byPriority !== 0) return byPriority;
      return b.signalCount - a.signalCount;
    });
}

function buildStats(currentSignals, archiveSignals, generatedAt) {
  const uniqueCountries = new Set(currentSignals.map((signal) => signal.country));
  const highPrioritySignals = currentSignals.filter((signal) => signal.priority === "Alta").length;
  const averagePoliticalScore =
    currentSignals.reduce((total, signal) => total + (signal.politicalScore ?? 0), 0) / Math.max(currentSignals.length, 1);

  return {
    generatedAt,
    activeSignals: currentSignals.length,
    archiveSignals: archiveSignals.length,
    countriesCovered: uniqueCountries.size,
    highPrioritySignals,
    averagePoliticalScore: Number(averagePoliticalScore.toFixed(2)),
  };
}

export async function ingest() {
  const enabledSources = sources.filter((source) => source.enabled !== false && source.feedUrl);
  const settled = await Promise.allSettled(enabledSources.map((source) => fetchSource(source)));
  const failures = [];
  const byId = new Map();

  settled.forEach((result, index) => {
    const source = enabledSources[index];
    if (result.status === "rejected") {
      failures.push({ source: source.id, error: result.reason.message });
      return;
    }

    result.value.forEach((signal) => {
      if (signal.title && !byId.has(signal.id)) {
        byId.set(signal.id, signal);
      }
    });
  });

  const selectedSignals = [...byId.values()].sort(scoreSignals).slice(0, 80);
  const generatedAt = new Date().toISOString();
  const archiveSignals = await readArchiveSignals();
  const merged = mergeArchiveSignals(selectedSignals, archiveSignals, generatedAt);
  const briefings = buildBriefings(merged.currentSignals);
  const stats = buildStats(merged.currentSignals, merged.archiveSignals, generatedAt);

  const payload = {
    generatedAt,
    count: merged.currentSignals.length,
    failures,
    stats,
    briefings,
    signals: merged.currentSignals,
  };

  const archivePayload = {
    updatedAt: generatedAt,
    count: merged.archiveSignals.length,
    signals: merged.archiveSignals,
  };

  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  await writeFile(archivePath, `${JSON.stringify(archivePayload, null, 2)}\n`, "utf8");

  return payload;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  ingest()
    .then((payload) => {
      console.log(`Wrote ${payload.count} signals to ${outputPath}`);
      if (payload.failures.length) {
        console.warn(`${payload.failures.length} sources failed`);
      }
    })
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
}
