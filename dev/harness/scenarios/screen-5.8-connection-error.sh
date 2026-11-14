#!/bin/sh
# Screen 5.8 (unchanged screens) — connection error and mirror failover:
# MirrorFailover and the connection-error text inside the results panel.
# MODE=failover seeds the states and hangs the search so the skeleton stays.
REPO="$(cd "$(dirname "$0")/../../.." && pwd)"
cd "$(mktemp -d)" || exit 1
MODE=failover exec python3 "$REPO/dev/harness/capture.py" \
  --cols 120 --rows 36 \
  --steps '[
    {"wait": 1.2},
    {"keys": "master", "after": 0.2},
    {"keys": "\r", "after": 1.5},
    {"snap": "5.8-connection-error"}
  ]' \
  -- bun --preload "$REPO/dev/harness/preload.ts" "$REPO/dev/harness/run.tsx"
