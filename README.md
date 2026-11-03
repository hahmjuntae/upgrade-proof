# Upgrade Proof

Upgrade Proof is an agent for teams that review npm dependency upgrades. You give it a project, a package, and a target version. The agent runs the upgrade in a disposable sandbox on Vultr. It returns an evidence bundle: the diff, every test log, the blocked network calls, and a SHA-256 manifest.

Built for the Vultr Agent Rush hackathon, Challenge 1.

## Problem

An upgrade PR often says "tested locally" and shows no proof. Install scripts also run with the developer's environment. A compromised dependency can read tokens and send them out during `npm install`.

## How it works

```
request → plan (Vultr Serverless Inference)
        → sandbox: baseline install + test
        → sandbox: npm install <pkg>@<version>
        → sandbox: test
        → on failure: model proposes a fix, test again (max 3 tries)
        → destroy sandbox → evidence bundle
```

Each sandbox is a Docker container with these limits:

| Control | Setting |
|---|---|
| Network | Internal Docker network. The only exit is an egress proxy that allows `registry.npmjs.org`. |
| Secrets | No host environment variables. The model key stays in the agent process. |
| Privileges | `--cap-drop ALL`, `no-new-privileges`, non-root user, read-only root file system |
| Resources | 1 CPU, 1 GB memory, 256 processes, 5 minute timeout per step |
| Lifetime | `--rm`. The container is deleted after each step. |

The proxy writes each refused connection to `egress.jsonl`. The bundle includes these records.

## Vultr services

| Service | Use |
|---|---|
| Serverless Inference | Upgrade plan and code fixes (OpenAI-compatible API) |
| Cloud Compute | Agent server, Docker sandboxes, egress proxy |

## Run locally

Requirements: Node.js 24, Docker.

```bash
docker compose -f deploy/compose.yml up -d
cp .env.example .env   # add VULTR_INFERENCE_API_KEY
npm test
npm run demo
npm start              # http://localhost:8080
```

Without a model key, the agent uses an offline planner and skips the fix loop.

## Demo project

`fixtures/demo-app` pins `chalk@4`. Its test helper has a hostile `postinstall` script. The script looks for secret-like environment variables and tries to send them to `collector.attacker.invalid`. In the sandbox, the script finds no secrets and the proxy blocks the call.

## Status

Work in progress. The project started at the hackathon kickoff on 2026-11-04 (KST).

## License

MIT
