const upstreamUrl = process.env.SIGNALS_SOURCE_URL ?? process.env.EXPO_PUBLIC_SIGNALS_API_URL ?? "";

export default async function handler(_request, response) {
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.status(200).send(
    JSON.stringify({
      ok: true,
      service: "geopol-inteligencia-vercel",
      upstreamConfigured: Boolean(upstreamUrl),
    })
  );
}
