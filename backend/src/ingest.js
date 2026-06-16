import { XMLParser } from "fast-xml-parser";
import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { sources } from "./sources.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outputPath = join(__dirname, "..", "data", "signals.json");
const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "",
  textNodeName: "text",
});

const highPriorityTerms = [
  "crisis",
  "elección",
  "elecciones",
  "congreso",
  "corrupción",
  "fiscalía",
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

function topicFor(source, title, summary) {
  const haystack = `${title} ${summary}`.toLowerCase();
  if (haystack.match(/seguridad|violencia|crimen|militar|narcotráfico|narcotrafico/)) return "Seguridad";
  if (haystack.match(/elecci|campaña|voto|encuesta/)) return "Elecciones";
  if (haystack.match(/econom|fiscal|presupuesto|deuda|inflación|inflacion/)) return "Economía política";
  if (haystack.match(/corrup|fiscalía|fiscalia|tribunal|corte|justicia/)) return "Instituciones";
  if (haystack.match(/sancion|diplom|frontera|migraci/)) return "Diplomacia";
  return source.defaultTopic;
}

function priorityFor(title, summary) {
  const haystack = `${title} ${summary}`.toLowerCase();
  const score = highPriorityTerms.reduce((total, term) => total + (haystack.includes(term) ? 1 : 0), 0);
  return score >= 2 ? "Alta" : "Media";
}

function toSignal(source, item) {
  const title = stripHtml(item.title);
  const summary = stripHtml(item.description ?? item.summary ?? item["content:encoded"]).slice(0, 260);
  const url = linkFrom(item) || source.siteUrl;
  const publishedAt = item.pubDate ?? item.published ?? item.updated ?? item["dc:date"] ?? null;
  const topic = topicFor(source, title, summary);

  return {
    id: createHash("sha256").update(`${source.id}:${url || title}`).digest("hex").slice(0, 16),
    country: source.country,
    source: source.name,
    sourceType: source.type,
    topic,
    priority: priorityFor(title, summary),
    title,
    summary: summary || `Última actualización de ${source.name}.`,
    url,
    publishedAt,
  };
}

async function fetchSource(source) {
  const response = await fetch(source.feedUrl, {
    headers: {
      "user-agent": "GeoPolInteligenciaBot/0.1 (+https://github.com/AndyBallesteros/GeoPol-Inteligencia)",
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

  return [...rssItems, ...atomItems].slice(0, 8).map((item) => toSignal(source, item));
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

  const signals = [...byId.values()]
    .sort((a, b) => new Date(b.publishedAt ?? 0) - new Date(a.publishedAt ?? 0))
    .slice(0, 80);

  const payload = {
    generatedAt: new Date().toISOString(),
    count: signals.length,
    failures,
    signals,
  };

  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");

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
