// 슬라이드 HTML을 장별 PNG와 PDF로 출력(ego-browser nodejs 전용)
const fs = await import("node:fs");
const V = "/Users/hahmjuntae/Desktop/workspace/personal/hackathons/upgrade-proof/video/";
const task = await taskSpace("upgrade-proof slides");
const p = task.page("p1");
await p.cdp("Emulation.setDeviceMetricsOverride", { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });
await p.goto("file://" + V + "slides.html");
await p.waitForTimeout(1500);
const n = await p.evaluate(() => document.querySelectorAll("section").length);
for (let i = 1; i <= n; i++) {
  await p.evaluate((k) => document.querySelectorAll("section").forEach((s) => (s.style.display = s.id === "s" + k ? "flex" : "none")), i);
  await p.waitForTimeout(250);
  const r = await p.cdp("Page.captureScreenshot", { format: "png", clip: { x: 0, y: 0, width: 1920, height: 1080, scale: 1 } });
  fs.writeFileSync(`${V}frames/slides/s${i}.png`, Buffer.from(r.data, "base64"));
}
await p.evaluate(() => document.querySelectorAll("section").forEach((s) => (s.style.display = "flex")));
await p.cdp("Emulation.clearDeviceMetricsOverride");
const pdf = await p.cdp("Page.printToPDF", { preferCSSPageSize: true, printBackground: true });
fs.writeFileSync(V + "out/upgrade-proof-slides.pdf", Buffer.from(pdf.data, "base64"));
console.log("slides", n);
