#!/bin/sh
# Flow 1 — motivating flow (spec §8.3.1): search, move to item 2, space.
# The row shows ●, the header shows ● 1 in bulk and the detail panel shows
# "In bulk queue" — one key press for the whole act-on-item step.
REPO="$(cd "$(dirname "$0")/../../.." && pwd)"
cd "$(mktemp -d)" || exit 1
exec python3 "$REPO/dev/harness/capture.py" \
  --cols 120 --rows 36 \
  --steps '[
    {"wait": 1.2},
    {"keys": "master", "after": 0.2},
    {"keys": "\r", "after": 2.4},
    {"snap": "flow1-results"},
    {"keys": "\u001b[B", "after": 0.4},
    {"snap": "flow1-item2-detail"},
    {"keys": " ", "after": 0.5},
    {"snap": "flow1-bulk-selected"}
  ]' \
  -- bun --preload "$REPO/dev/harness/preload.ts" "$REPO/dev/harness/run.tsx"
