import http from "node:http";
import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join, resolve, extname } from "node:path";
import { runUpgrade } from "./agent.js";

const ROOT = resolve(import.meta.dirname, "..");
const FIXTURES = { "demo-app": join(ROOT, "fixtures/demo-app") };
const runs = new Map();
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".json": "application/json" };

function json(res, status, body) {
  res.writeHead(status, { "content-type": "application/json" }).end(JSON.stringify(body));
}

async function readBody(req) {
  let raw = "";
  for await (const chunk of req) raw += chunk;
  return raw ? JSON.parse(raw) : {};
}

function startRun({ fixture, pkg, version }) {
  const id = randomUUID().slice(0, 8);
  const run = { id, fixture, pkg, version, status: "running", events: [], listeners: new Set() };
  runs.set(id, run);
  const emit = (event) => {
    run.events.push(event);
    for (const send of run.listeners) send(event);
  };
  runUpgrade({ source: FIXTURES[fixture], pkg, version, runDir: join(ROOT, "runs", id), egressLog: process.env.EGRESS_LOG, emit })
    .then((result) => Object.assign(run, { status: "done", summary: result.summary, manifestSha256: result.manifestSha256 }))
    .catch((err) => {
      run.status = "error";
      emit({ type: "error", message: err.message });
    });
  return run;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  try {
    if (req.method === "POST" && url.pathname === "/api/runs") {
      const { fixture = "demo-app", pkg, version } = await readBody(req);
      if (!FIXTURES[fixture] || !/^(@[\w.-]+\/)?[\w.-]+$/.test(pkg ?? "") || !/^[\w.^~<>=-]+$/.test(version ?? "")) {
        return json(res, 400, { error: "fixture, pkg, version are required and must be plain npm names" });
      }
      const run = startRun({ fixture, pkg, version });
      return json(res, 202, { id: run.id });
    }
    const match = url.pathname.match(/^\/api\/runs\/(\w+)(\/events|\/evidence\/([\w.-]+))?$/);
    if (match) {
      const run = runs.get(match[1]);
      if (!run) return json(res, 404, { error: "run not found" });
      if (match[2] === "/events") {
        res.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-cache" });
        const send = (e) => res.write(`data: ${JSON.stringify(e)}\n\n`);
        run.events.forEach(send);
        run.listeners.add(send);
        req.on("close", () => run.listeners.delete(send));
        return;
      }
      if (match[3]) {
        const file = join(ROOT, "runs", run.id, "evidence", match[3]);
        if (!existsSync(file)) return json(res, 404, { error: "file not found" });
        res.writeHead(200, { "content-type": "text/plain; charset=utf-8" }).end(readFileSync(file));
        return;
      }
      const { listeners, ...view } = run;
      return json(res, 200, view);
    }
    const path = url.pathname === "/" ? "/index.html" : url.pathname;
    const file = join(ROOT, "public", path);
    if (file.startsWith(join(ROOT, "public")) && existsSync(file)) {
      res.writeHead(200, { "content-type": TYPES[extname(file)] ?? "application/octet-stream" }).end(readFileSync(file));
      return;
    }
    json(res, 404, { error: "not found" });
  } catch (err) {
    json(res, 500, { error: err.message });
  }
});

const port = Number(process.env.PORT || 8080);
server.listen(port, () => console.log(`upgrade-proof on :${port}`));
