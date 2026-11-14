#!/bin/sh
# Screen 5.3 — the Queue panel during a bulk run at 120x36 (spec §5.3).
# MODE=bulkfail makes MD5s starting with 11 fail (row 1 of the fake page).
REPO="$(cd "$(dirname "$0")/../../.." && pwd)"
cd "$(mktemp -d)" || exit 1
MODE=bulkfail exec python3 "$REPO/dev/harness/capture.py" \
  --cols 120 --rows 36 \
  --steps '[
    {"wait": 1.2},
    {"keys": "master", "after": 0.2},
    {"keys": "\r", "after": 2.4},
    {"keys": " ", "after": 0.3},
    {"keys": "\u001b[B", "after": 0.2},
    {"keys": " ", "after": 0.3},
    {"keys": "\u001b[B", "after": 0.2},
    {"keys": " ", "after": 0.3},
    {"keys": "b", "after": 1.2},
    {"snap": "5.3-queue-panel-running"}
  ]' \
  -- bun --preload "$REPO/dev/harness/preload.ts" "$REPO/dev/harness/run.tsx"
