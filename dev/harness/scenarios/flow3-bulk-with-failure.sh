#!/bin/sh
# Flow 3 — bulk run with a failure (spec §8.3.3, MODE=bulkfail): three items
# selected, b opens the Queue panel in place, row 1 (MD5 11…) fails with a
# reason, the run completes, the failed item stays ● and r retries it.
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
    {"keys": "b", "after": 1.0},
    {"snap": "flow3-run-started"},
    {"wait": 2.0},
    {"snap": "flow3-failure-reason"},
    {"wait": 7.0},
    {"snap": "flow3-run-complete"},
    {"keys": "r", "after": 0.35},
    {"snap": "flow3-retry-started"},
    {"wait": 1.2},
    {"snap": "flow3-retry-failed-again"}
  ]' \
  -- bun --preload "$REPO/dev/harness/preload.ts" "$REPO/dev/harness/run.tsx"
