#!/bin/sh
# Edge cases from spec §8.4 that are cheap to capture:
#   - zero results: `No results for "<query>"` centred, / and q still work;
#   - the min-chars warning in search mode (the warning line must not push
#     the footer off-screen);
#   - a terminal smaller than 40x12 shows `Terminal too small (min 40x12)`
#     with the current size and q still works;
#   - long titles truncate with … in rows and wrap in the full detail
#     (60x20 full detail).
REPO="$(cd "$(dirname "$0")/../../.." && pwd)"
cd "$(mktemp -d)" || exit 1

python3 "$REPO/dev/harness/capture.py" \
  --cols 120 --rows 36 \
  --steps '[
    {"wait": 1.2},
    {"keys": "zzz", "after": 0.2},
    {"keys": "\r", "after": 2.4},
    {"snap": "edge-zero-results"},
    {"keys": "/", "after": 0.5},
    {"snap": "edge-zero-results-search"},
    {"keys": "\u0015", "after": 0.2},
    {"keys": "ab", "after": 0.3},
    {"keys": "\r", "after": 0.5},
    {"snap": "edge-min-chars-warning"}
  ]' \
  -- bun --preload "$REPO/dev/harness/preload.ts" "$REPO/dev/harness/run.tsx"

echo "=== 35x10 run (terminal too small) ==="

python3 "$REPO/dev/harness/capture.py" \
  --cols 35 --rows 10 \
  --steps '[
    {"wait": 1.2},
    {"keys": "master", "after": 0.2},
    {"keys": "\r", "after": 2.4},
    {"snap": "edge-too-small"},
    {"keys": "q", "after": 0.6},
    {"snap": "edge-too-small-quit"}
  ]' \
  -- bun --preload "$REPO/dev/harness/preload.ts" "$REPO/dev/harness/run.tsx"

echo "=== 60x20 run (long title truncates in the row, wraps in full detail) ==="

MODE=longtitle python3 "$REPO/dev/harness/capture.py" \
  --cols 60 --rows 20 \
  --steps '[
    {"wait": 1.5},
    {"snap": "edge-long-title-row"},
    {"keys": "\r", "after": 0.5},
    {"snap": "edge-full-detail-wrapped"}
  ]' \
  -- bun --preload "$REPO/dev/harness/preload.ts" "$REPO/dev/harness/run.tsx"
