#!/bin/sh
# Flow 8 — the resize set (spec §8.3.8): 120x36, 100x30, 80x30, 60x20, live
# on resize. No wrapped rows, broken borders or overlapping text; at 60x20
# the list scrolls (fewer rows than results) with the position marker kept
# correct.
REPO="$(cd "$(dirname "$0")/../../.." && pwd)"
cd "$(mktemp -d)" || exit 1
exec python3 "$REPO/dev/harness/capture.py" \
  --cols 120 --rows 36 \
  --steps '[
    {"wait": 1.2},
    {"keys": "master", "after": 0.2},
    {"keys": "\r", "after": 2.4},
    {"snap": "flow8-120x36"},
    {"resize": [100, 30], "after": 0.8},
    {"snap": "flow8-100x30"},
    {"resize": [80, 30], "after": 0.8},
    {"snap": "flow8-80x30"},
    {"resize": [60, 20], "after": 0.8},
    {"keys": "\u001b[6~", "after": 0.4},
    {"snap": "flow8-60x20-pgdn"}
  ]' \
  -- bun --preload "$REPO/dev/harness/preload.ts" "$REPO/dev/harness/run.tsx"
