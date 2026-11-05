// 증거 파일 원문 화면 캡처(ego-browser nodejs 전용)
const fs = await import("node:fs");
const { run, files } = JSON.parse(fs.readFileSync("/Users/hahmjuntae/Desktop/workspace/personal/hackathons/upgrade-proof/video/capture-files.json", "utf8"));
const dir = "/Users/hahmjuntae/Desktop/workspace/personal/hackathons/upgrade-proof/video/frames/files/";
fs.mkdirSync(dir, { recursive: true });
const task = await taskSpace(131);
const p = task.page("p1");
await p.cdp("Emulation.setDeviceMetricsOverride", { width: 1440, height: 810, deviceScaleFactor: 4 / 3, mobile: false });
for (const f of files) {
  await p.goto(`https://141-164-38-123.sslip.io/api/runs/${run}/evidence/${f}`);
  await p.evaluate((name) => {
    const text = document.body.innerText;
    document.body.innerHTML = "";
    document.body.style.cssText = "margin:0;background:#141414;color:#e8e8e3;font:15px/1.55 ui-monospace,Menlo,monospace;padding:36px 48px";
    const h = document.createElement("div");
    h.textContent = "evidence / " + name;
    h.style.cssText = "font:600 18px -apple-system,sans-serif;color:#9a9a92;margin-bottom:18px;letter-spacing:.04em";
    const pre = document.createElement("pre");
    pre.textContent = text;
    pre.style.cssText = "margin:0;white-space:pre-wrap;word-break:break-all";
    document.body.append(h, pre);
  }, f);
  await p.waitForTimeout(300);
  const r = await p.cdp("Page.captureScreenshot", { format: "png" });
  fs.writeFileSync(dir + f.replace(/\W/g, "_") + ".png", Buffer.from(r.data, "base64"));
}
await p.cdp("Emulation.clearDeviceMetricsOverride");
console.log("ok", files.length);
