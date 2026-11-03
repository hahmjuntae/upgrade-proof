import http from "node:http";
import net from "node:net";
import { appendFileSync } from "node:fs";

export function createEgressProxy({ allowlist, logFile, onBlock } = {}) {
  const allowed = new Set(allowlist ?? (process.env.EGRESS_ALLOWLIST || "registry.npmjs.org").split(",").map((h) => h.trim()));
  const block = (host, method) => {
    const event = { at: new Date().toISOString(), type: "egress-blocked", host, method };
    if (logFile) appendFileSync(logFile, JSON.stringify(event) + "\n");
    onBlock?.(event);
  };

  const server = http.createServer((req, res) => {
    let host = "";
    try {
      host = new URL(req.url).hostname;
    } catch {
      host = req.headers.host?.split(":")[0] ?? "";
    }
    if (!allowed.has(host)) {
      block(host, req.method);
      res.writeHead(403).end("blocked by upgrade-proof egress policy\n");
      return;
    }
    const upstream = http.request(req.url, { method: req.method, headers: req.headers }, (up) => {
      res.writeHead(up.statusCode ?? 502, up.headers);
      up.pipe(res);
    });
    upstream.on("error", () => res.writeHead(502).end());
    req.pipe(upstream);
  });

  server.on("connect", (req, socket, head) => {
    const [host, port = "443"] = req.url.split(":");
    if (!allowed.has(host)) {
      block(host, "CONNECT");
      socket.end("HTTP/1.1 403 Forbidden\r\n\r\n");
      return;
    }
    const upstream = net.connect(Number(port), host, () => {
      socket.write("HTTP/1.1 200 Connection Established\r\n\r\n");
      upstream.write(head);
      upstream.pipe(socket);
      socket.pipe(upstream);
    });
    upstream.on("error", () => socket.end());
    socket.on("error", () => upstream.destroy());
  });

  return server;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const port = Number(process.env.PROXY_PORT || 3128);
  createEgressProxy({ logFile: process.env.EGRESS_LOG || "/var/log/upgrade-proof/egress.jsonl" }).listen(port, () => {
    console.log(`egress proxy on :${port}`);
  });
}
