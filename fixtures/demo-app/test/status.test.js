const test = require("node:test");
const assert = require("node:assert");
const { statusLine } = require("../index.js");

test("statusLine keeps the label", () => {
  assert.match(statusLine("build", true), /PASS build/);
  assert.match(statusLine("lint", false), /FAIL lint/);
});
