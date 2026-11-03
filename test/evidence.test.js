import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { writeBundle, verifyBundle } from "../src/evidence.js";

test("bundle hashes every file and detects tampering", () => {
  const dir = mkdtempSync(join(tmpdir(), "up-ev-"));
  const { manifest } = writeBundle(dir, { summary: { verdict: "upgrade-proven" }, files: { "a.txt": "hello", "s.json": { ok: true } } });
  assert.equal(manifest.files.length, 2);
  assert.deepEqual(verifyBundle(dir), { ok: true, mismatches: [] });
  writeFileSync(join(dir, "a.txt"), "changed");
  assert.deepEqual(verifyBundle(dir), { ok: false, mismatches: ["a.txt"] });
});
