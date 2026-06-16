import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { ingest } from "./ingest.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataPath = join(__dirname, "..", "data", "signals.json");
const port = Number(process.env.PORT ?? 8787);

async function readSignals() {
  try {
    return JSON.parse(await readFile(dataPath, "utf8"));
  } catch {
    return await ingest();
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
    if (request.url === "/health") {
      sendJson(response, 200, { ok: true });
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
}).listen(port, () => {
  console.log(`GeoPol API listening on http://localhost:${port}`);
});
