import { resolve, join } from "node:path";
import { runUpgrade } from "./agent.js";

const [source, pkg, version] = process.argv.slice(2);
if (!source || !pkg || !version) {
  console.error("usage: node src/cli.js <project-dir> <package> <version>");
  process.exit(2);
}
const runDir = resolve("runs", new Date().toISOString().replace(/[:.]/g, "-"));
const result = await runUpgrade({
  source: resolve(source), pkg, version, runDir,
  egressLog: process.env.EGRESS_LOG,
  emit: (e) => console.log(e.type === "log" ? `  ${e.line}` : JSON.stringify(e)),
});
console.log(`verdict: ${result.summary.verdict}`);
console.log(`evidence: ${join(runDir, "evidence")} (manifest sha256 ${result.manifestSha256})`);
