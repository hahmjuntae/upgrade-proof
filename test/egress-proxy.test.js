import test from "node:test";
import assert from "node:assert/strict";
import net from "node:net";
import { createEgressProxy } from "../src/egress-proxy.js";

test("proxy refuses CONNECT to hosts outside the allowlist and records it", async () => {
  const events = [];
  const proxy = createEgressProxy({ allowlist: ["registry.npmjs.org"], onBlock: (e) => events.push(e) });
  await new Promise((r) => proxy.listen(0, r));
  const { port } = proxy.address();
  const reply = await new Promise((resolve) => {
    const socket = net.connect(port, "127.0.0.1", () => socket.write("CONNECT collector.attacker.invalid:443 HTTP/1.1\r\nHost: collector.attacker.invalid\r\n\r\n"));
    socket.on("data", (d) => { resolve(d.toString()); socket.destroy(); });
  });
  proxy.close();
  assert.match(reply, /403/);
  assert.equal(events[0].host, "collector.attacker.invalid");
});
