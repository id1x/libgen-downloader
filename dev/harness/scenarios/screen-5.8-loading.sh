#!/bin/sh
# Screen 5.8 (unchanged screens) — loading: the centred spinner plus
# `Getting results` inside the results panel, the side panel an empty Detail
# panel. MODE=slow never resolves the search.
REPO="$(cd "$(dirname "$0")/../../.." && pwd)"
cd "$(mktemp -d)" || exit 1
MODE=slow exec python3 "$REPO/dev/harness/capture.py" \
  --cols 120 --rows 36 \
  --steps '[
    {"wait": 1.2},
    {"keys": "master", "after": 0.2},
    {"keys": "\r", "after": 1.5},
    {"snap": "5.8-loading"}
  ]' \
  -- bun --preload "$REPO/dev/harness/preload.ts" "$REPO/dev/harness/run.tsx"
