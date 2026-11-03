import test from "node:test";
import assert from "node:assert/strict";
import { dockerArgs } from "../src/sandbox.js";

test("sandbox drops capabilities, limits resources, and passes no host secrets", () => {
  const args = dockerArgs({ workdir: "/tmp/w", command: "npm test", name: "t" });
  for (const flag of ["--cap-drop", "--read-only", "--pids-limit", "--memory", "--cpus", "--network"]) assert.ok(args.includes(flag), flag);
  const envs = args.filter((_, i) => args[i - 1] === "-e");
  assert.ok(envs.every((e) => !/TOKEN|SECRET|API_KEY|PASSWORD/i.test(e)), envs.join(","));
});
