// 실제 VM 실행 화면을 1초 간격으로 찍는 녹화 스크립트(ego-browser nodejs 전용)
// 사용: video/capture.json 작성 후 ego-browser nodejs < video/capture.mjs
const fs = await import("node:fs");
const { name = "demo", mode = "fixture", pkg = "chalk", version = "5.4.1", repo = "" } = JSON.parse(fs.readFileSync("/Users/hahmjuntae/Desktop/workspace/personal/hackathons/upgrade-proof/video/capture.json", "utf8"));
const dir = `/Users/hahmjuntae/Desktop/workspace/personal/hackathons/upgrade-proof/video/frames/${name}/`;
fs.rmSync(dir, { recursive: true, force: true });
fs.mkdirSync(dir, { recursive: true });
const task = await taskSpace(131);
const p = task.page("p1");
await p.goto("https://141-164-38-123.sslip.io/");
await p.cdp("Emulation.setDeviceMetricsOverride", { width: 1440, height: 810, deviceScaleFactor: 4 / 3, mobile: false });
await p.waitForTimeout(1500);
const index = [];
let n = 0;
const t0 = Date.now();
const shot = async (tag) => {
  n += 1;
  const file = `${String(n).padStart(4, "0")}.png`;
  const r = await p.cdp("Page.captureScreenshot", { format: "png" });
  fs.writeFileSync(dir + file, Buffer.from(r.data, "base64"));
  const state = await p.evaluate(() => ({
    run: document.getElementById("run-state")?.innerText,
    verdict: document.getElementById("verdict")?.innerText,
    blocked: document.getElementById("blocked-count")?.innerText,
  }));
  index.push({ file, t: (Date.now() - t0) / 1000, tag, ...state });
};
await shot("idle");
await p.selectOption("css:#source", mode === "repo" ? "repo" : "fixture");
await p.waitForTimeout(400);
if (mode === "repo") await p.fill("css:#repo", repo);
await p.fill("css:#pkg", pkg);
await p.fill("css:#version", version);
await shot("filled");
await p.click("css:#run", { label: "업그레이드 실행" });
for (let i = 0; i < 400; i++) {
  await p.waitForTimeout(1000);
  await shot("run");
  const done = await p.evaluate(() => /proven|fails|broken|error|failed/i.test(document.getElementById("verdict")?.innerText || ""));
  if (done && index.filter((x) => x.tag === "after").length >= 4) break;
  if (done) index[index.length - 1].tag = "after";
}
fs.writeFileSync(dir + "index.json", JSON.stringify(index, null, 1));
await p.cdp("Emulation.clearDeviceMetricsOverride");
console.log(JSON.stringify({ frames: n, last: index.at(-1) }));
