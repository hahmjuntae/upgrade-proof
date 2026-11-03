import { spawn } from "node:child_process";

const IMAGE = process.env.SANDBOX_IMAGE || "node:24-bookworm-slim";
const NETWORK = process.env.SANDBOX_NETWORK || "upgrade-proof-sandbox";
const PROXY = process.env.EGRESS_PROXY_URL || "http://egress-proxy:3128";

export function dockerArgs({ workdir, command, name }) {
  return [
    "run", "--rm", "--name", name,
    "--network", NETWORK,
    "--cpus", "1", "--memory", "1g", "--pids-limit", "256",
    "--cap-drop", "ALL", "--security-opt", "no-new-privileges",
    "--user", `${process.getuid?.() ?? 1000}:${process.getgid?.() ?? 1000}`,
    "--read-only", "--tmpfs", "/tmp:rw,size=256m", "--tmpfs", "/home/node:rw,size=256m,mode=1777",
    "-v", `${workdir}:/work`, "-w", "/work",
    "-e", "HOME=/home/node",
    "-e", `HTTP_PROXY=${PROXY}`, "-e", `HTTPS_PROXY=${PROXY}`,
    "-e", `npm_config_proxy=${PROXY}`, "-e", `npm_config_https_proxy=${PROXY}`,
    "-e", "NODE_USE_ENV_PROXY=1",
    "-e", "npm_config_audit=false", "-e", "npm_config_fund=false",
    IMAGE, "sh", "-c", command,
  ];
}

export function runInSandbox({ workdir, command, timeoutMs = 300_000, onLine }) {
  const name = `upgrade-proof-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  const started = Date.now();
  return new Promise((resolve) => {
    const child = spawn("docker", dockerArgs({ workdir, command, name }), { env: { PATH: process.env.PATH } });
    let output = "";
    const push = (chunk) => {
      const text = chunk.toString();
      output += text;
      if (onLine) for (const line of text.split("\n")) if (line.trim()) onLine(line);
    };
    child.stdout.on("data", push);
    child.stderr.on("data", push);
    const timer = setTimeout(() => {
      push(`[sandbox] timeout after ${timeoutMs} ms, killing ${name}\n`);
      spawn("docker", ["kill", name]);
    }, timeoutMs);
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ command, code, output, durationMs: Date.now() - started, container: name });
    });
    child.on("error", (err) => {
      clearTimeout(timer);
      resolve({ command, code: -1, output: `[sandbox] ${err.message}`, durationMs: Date.now() - started, container: name });
    });
  });
}
