#!/bin/sh
# Screen 5.2 — narrow browse, stacked (Detail below the list) at 80x30
# (spec §5.2). MODE=statuses seeds the same status mix as 5.1.
REPO="$(cd "$(dirname "$0")/../../.." && pwd)"
cd "$(mktemp -d)" || exit 1
MODE=statuses exec python3 "$REPO/dev/harness/capture.py" \
  --cols 80 --rows 30 \
  --steps '[
    {"wait": 1.2},
    {"keys": "master", "after": 0.2},
    {"keys": "\r", "after": 2.4},
    {"snap": "5.2-stacked-browse"}
  ]' \
  -- bun --preload "$REPO/dev/harness/preload.ts" "$REPO/dev/harness/run.tsx"
