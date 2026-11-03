import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export function sha256(data) {
  return createHash("sha256").update(data).digest("hex");
}

export function writeBundle(dir, { summary, files }) {
  mkdirSync(dir, { recursive: true });
  const entries = [];
  for (const [name, content] of Object.entries(files)) {
    const body = typeof content === "string" ? content : JSON.stringify(content, null, 2);
    writeFileSync(join(dir, name), body);
    entries.push({ name, bytes: Buffer.byteLength(body), sha256: sha256(body) });
  }
  const manifest = { schema: "upgrade-proof/evidence@1", createdAt: new Date().toISOString(), summary, files: entries };
  const manifestBody = JSON.stringify(manifest, null, 2);
  writeFileSync(join(dir, "manifest.json"), manifestBody);
  return { manifest, manifestSha256: sha256(manifestBody) };
}

export function verifyBundle(dir) {
  const manifest = JSON.parse(readFileSync(join(dir, "manifest.json"), "utf8"));
  const mismatches = manifest.files.filter((f) => sha256(readFileSync(join(dir, f.name))) !== f.sha256).map((f) => f.name);
  return { ok: mismatches.length === 0, mismatches };
}
