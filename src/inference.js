const BASE_URL = process.env.VULTR_INFERENCE_BASE_URL || "https://api.vultrinference.com/v1";
const MODEL = process.env.VULTR_INFERENCE_MODEL || "qwen3.8-27b";

export function inferenceMode() {
  return process.env.VULTR_INFERENCE_API_KEY ? "vultr" : "offline";
}

export async function chat(messages, { model = MODEL, temperature = 0.2, timeoutMs = 60_000 } = {}) {
  const key = process.env.VULTR_INFERENCE_API_KEY;
  if (!key) throw new Error("VULTR_INFERENCE_API_KEY is not set");
  const res = await fetch(`${BASE_URL}/chat/completions`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
    body: JSON.stringify({ model, messages, temperature }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new Error(`inference ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  return { model: data.model || model, content: data.choices?.[0]?.message?.content ?? "", usage: data.usage };
}

function extractJson(text) {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("model reply has no JSON object");
  return JSON.parse(match[0]);
}

export async function planUpgrade({ pkg, version, manifest }) {
  if (inferenceMode() === "offline") {
    return {
      source: "offline",
      steps: ["baseline-test", "upgrade", "post-test", "fix-loop", "bundle"],
      risk: `Upgrade ${pkg} to ${version}. Check the changelog for breaking changes.`,
    };
  }
  const reply = await chat([
    {
      role: "system",
      content:
        "You plan npm dependency upgrades. Reply with JSON only: {\"risk\": string, \"breakingChanges\": string[], \"filesToWatch\": string[]}.",
    },
    { role: "user", content: `Upgrade ${pkg} to ${version}.\npackage.json:\n${manifest}` },
  ]);
  return { source: reply.model, steps: ["baseline-test", "upgrade", "post-test", "fix-loop", "bundle"], ...extractJson(reply.content) };
}

export async function proposeFix({ pkg, version, testLog, files }) {
  if (inferenceMode() === "offline") return { source: "offline", edits: [], note: "No model key. Fix loop skipped." };
  const listing = files.map((f) => `--- ${f.path}\n${f.content}`).join("\n\n");
  const reply = await chat([
    {
      role: "system",
      content:
        "You fix code after an npm upgrade breaks tests. Reply with JSON only: {\"note\": string, \"edits\": [{\"path\": string, \"content\": string}]}. Each edit replaces the whole file. Do not touch package.json or lockfiles.",
    },
    { role: "user", content: `Upgraded ${pkg} to ${version}. Tests fail.\n\nTest log (tail):\n${testLog.slice(-4000)}\n\nSource files:\n${listing}` },
  ]);
  return { source: reply.model, ...extractJson(reply.content) };
}
