import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { planUpgrade, proposeFix, inferenceMode } from "./inference.js";
import { runInSandbox } from "./sandbox.js";
import { writeBundle } from "./evidence.js";

const MAX_FIX_ATTEMPTS = 3;

function git(cwd, ...args) {
  return spawnSync("git", args, { cwd, encoding: "utf8" });
}

function sourceFiles(root) {
  const out = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (["node_modules", ".git"].includes(entry.name)) continue;
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.(c|m)?js$|\.ts$/.test(entry.name)) out.push({ path: relative(root, full), content: readFileSync(full, "utf8") });
    }
  };
  walk(root);
  return out.slice(0, 20);
}

function blockedSince(egressLog, sinceIso) {
  if (!egressLog || !existsSync(egressLog)) return [];
  return readFileSync(egressLog, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line))
    .filter((e) => e.at >= sinceIso);
}

export async function runUpgrade({ source, pkg, version, runDir, egressLog, emit = () => {} }) {
  const startedAt = new Date().toISOString();
  const work = join(runDir, "work");
  mkdirSync(runDir, { recursive: true });
  cpSync(source, work, { recursive: true, filter: (p) => !/[\/](node_modules|\.git)([\/]|$)/.test(p) });
  git(work, "init", "-q");
  git(work, "add", "-A");
  git(work, "-c", "user.name=upgrade-proof", "-c", "user.email=agent@upgrade-proof.local", "commit", "-qm", "baseline");

  const steps = [];
  const step = async (name, command) => {
    emit({ type: "step", name, command });
    const result = await runInSandbox({ workdir: work, command, onLine: (line) => emit({ type: "log", step: name, line }) });
    steps.push({ name, ...result });
    emit({ type: "step-done", name, code: result.code, durationMs: result.durationMs });
    return result;
  };

  const plan = await planUpgrade({ pkg, version, manifest: readFileSync(join(work, "package.json"), "utf8") });
  emit({ type: "plan", plan });

  const baseline = await step("baseline-test", "npm install --no-audit --no-fund && npm test");
  await step("upgrade", `npm install --no-audit --no-fund ${pkg}@${version}`);
  let post = await step("post-test", "npm test");

  const fixes = [];
  for (let attempt = 1; post.code !== 0 && attempt <= MAX_FIX_ATTEMPTS; attempt++) {
    let fix;
    try {
      fix = await proposeFix({ pkg, version, testLog: post.output, files: sourceFiles(work) });
    } catch (error) {
      fix = { source: "error", edits: [], note: `Model fix failed: ${error.message}` };
    }
    fixes.push({ attempt, source: fix.source, note: fix.note, paths: fix.edits.map((e) => e.path) });
    emit({ type: "fix", attempt, note: fix.note });
    if (!fix.edits.length) break;
    for (const edit of fix.edits) {
      if (/package(-lock)?\.json$/.test(edit.path) || edit.path.includes("..")) continue;
      writeFileSync(join(work, edit.path), edit.content);
    }
    post = await step(`post-test-fix-${attempt}`, "npm test");
  }

  const diff = git(work, "diff", "--", ".", ":(exclude)package-lock.json").stdout;
  const blocked = blockedSince(egressLog, startedAt);
  const verdict = baseline.code !== 0 ? "baseline-broken" : post.code === 0 ? "upgrade-proven" : "upgrade-fails";
  const summary = {
    pkg, version, verdict, startedAt, finishedAt: new Date().toISOString(),
    inference: inferenceMode(), plan, fixes,
    steps: steps.map(({ name, command, code, durationMs, container }) => ({ name, command, code, durationMs, container })),
    containment: { blockedEgress: blocked.length, secretsInSandbox: 0 },
  };
  const logs = Object.fromEntries(steps.map((s) => [`log-${s.name}.txt`, s.output]));
  const bundle = writeBundle(join(runDir, "evidence"), {
    summary,
    files: { "summary.json": summary, "upgrade.diff": diff, "egress-blocked.jsonl": blocked.map((e) => JSON.stringify(e)).join("\n"), ...logs },
  });
  emit({ type: "done", verdict, manifestSha256: bundle.manifestSha256 });
  return { summary, ...bundle };
}
