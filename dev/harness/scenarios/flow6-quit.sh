#!/bin/sh
# Flow 6 — quit (spec §8.3.6). First run: q with nothing pending exits at
# once. Second run (MODE=freeze): with a download running and a selection,
# q opens the prompt with the right lines, n returns to the browse screen and
# y exits.
REPO="$(cd "$(dirname "$0")/../../.." && pwd)"
cd "$(mktemp -d)" || exit 1

python3 "$REPO/dev/harness/capture.py" \
  --cols 120 --rows 36 \
  --steps '[
    {"wait": 1.2},
    {"keys": "master", "after": 0.2},
    {"keys": "\r", "after": 2.4},
    {"keys": "q", "after": 0.6},
    {"snap": "flow6-plain-exit"}
  ]' \
  -- bun --preload "$REPO/dev/harness/preload.ts" "$REPO/dev/harness/run.tsx"

echo "=== MODE=freeze run ==="

MODE=freeze python3 "$REPO/dev/harness/capture.py" \
  --cols 80 --rows 30 \
  --steps '[
    {"wait": 1.2},
    {"keys": "master", "after": 0.2},
    {"keys": "\r", "after": 2.4},
    {"keys": "d", "after": 1.0},
    {"keys": " ", "after": 0.3},
    {"keys": "q", "after": 0.5},
    {"snap": "flow6-quit-prompt"},
    {"keys": "n", "after": 0.5},
    {"snap": "flow6-stay"},
    {"keys": "q", "after": 0.5},
    {"keys": "y", "after": 0.6},
    {"snap": "flow6-quit-anyway"}
  ]' \
  -- bun --preload "$REPO/dev/harness/preload.ts" "$REPO/dev/harness/run.tsx"
