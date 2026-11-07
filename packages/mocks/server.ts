// The one mock backend both apps talk to. Runs the MSW handlers over HTTP so that state is shared
// between apps and no browser service worker competes with the offline one.
import { existsSync, readFileSync } from "node:fs";
import { createServer, type IncomingMessage } from "node:http";
import { dirname, join } from "node:path";
import { Readable } from "node:stream";
import { fileURLToPath } from "node:url";
import { getResponse } from "msw";
import { createHandlers } from "./handlers";
import { loadFixtures } from "./load";

const here = dirname(fileURLToPath(import.meta.url));
const envFile = join(here, "..", "..", ".env");
if (existsSync(envFile)) process.loadEnvFile(envFile);

const iso3 = process.env.NEXT_PUBLIC_COUNTRY || "SEN";
const port = Number(process.env.MOCK_PORT) || 4000;
const latency = process.env.MOCK_LATENCY === "0" ? ([0, 0] as [number, number]) : undefined;

const handlers = createHandlers(loadFixtures(iso3), { latency });

function toRequest(req: IncomingMessage) {
  const url = `http://${req.headers.host ?? `localhost:${port}`}${req.url}`;
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (typeof value === "string") headers.set(key, value);
  }
  const hasBody = req.method !== "GET" && req.method !== "HEAD";
  return new Request(url, {
    method: req.method,
    headers,
    body: hasBody ? (Readable.toWeb(req) as ReadableStream) : undefined,
    ...(hasBody ? { duplex: "half" } : {}),
  } as RequestInit);
}

const geoPath = /^\/geo\/([A-Z]{3})\/(adm[1-3])\.topo\.json$/;

createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Accept-Language, Content-Type");

  const geo = geoPath.exec(req.url ?? "");
  if (geo) {
    const file = join(here, "fixtures", geo[1] as string, "geo", `${geo[2]}.topo.json`);
    if (existsSync(file)) {
      res.setHeader("Content-Type", "application/json");
      res.end(readFileSync(file));
      return;
    }
  }

  try {
    const response = await getResponse(handlers, toRequest(req));
    if (!response) {
      res.statusCode = 404;
      res.setHeader("Content-Type", "application/problem+json");
      res.end(JSON.stringify({ type: "about:blank", title: "Not found", status: 404 }));
      return;
    }
    res.statusCode = response.status;
    response.headers.forEach((value, key) => res.setHeader(key, value));
    res.end(Buffer.from(await response.arrayBuffer()));
  } catch (error) {
    console.error(error);
    res.statusCode = 500;
    res.end();
  }
}).listen(port, () => {
  console.log(`[mocks] ${iso3} API on http://localhost:${port}/api/v1`);
});
