#!/bin/sh
# Screen 5.5 — the help overlay at 80x30 (spec §5.5): a centred 46-column box
# over the dimmed browse screen.
REPO="$(cd "$(dirname "$0")/../../.." && pwd)"
cd "$(mktemp -d)" || exit 1
exec python3 "$REPO/dev/harness/capture.py" \
  --cols 80 --rows 30 \
  --steps '[
    {"wait": 1.2},
    {"keys": "master", "after": 0.2},
    {"keys": "\r", "after": 2.4},
    {"keys": "?", "after": 0.5},
    {"snap": "5.5-help-overlay"}
  ]' \
  -- bun --preload "$REPO/dev/harness/preload.ts" "$REPO/dev/harness/run.tsx"
