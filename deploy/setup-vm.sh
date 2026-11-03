#!/usr/bin/env bash
# Run once on a fresh Vultr Cloud Compute instance (Ubuntu 24.04).
set -euo pipefail
apt-get update
apt-get install -y ca-certificates curl git docker.io docker-compose-v2
curl -fsSL https://deb.nodesource.com/setup_24.x | bash -
apt-get install -y nodejs
mkdir -p /var/log/upgrade-proof
docker pull node:24-bookworm-slim
docker compose -f "$(dirname "$0")/compose.yml" up -d
