#!/bin/sh
# Before case: the demo upgrade by hand, without the sandbox. Uses fake tokens only.
set -u
cd "$(dirname "$0")/.."
docker run --rm -v "$PWD/fixtures/demo-app:/src:ro" \
  -e GITHUB_TOKEN=fake-demo-1 -e NPM_TOKEN=fake-demo-2 -e AWS_SECRET_ACCESS_KEY=fake-demo-3 \
  node:24-bookworm-slim sh -c 'cp -r /src /w && cd /w \
    && npm install --no-audit --no-fund --foreground-scripts && npm test; \
    npm install --no-audit --no-fund --foreground-scripts chalk@5.4.1; npm test'
