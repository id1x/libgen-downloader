#!/bin/sh
# Screen 5.8 (unchanged screens) — fatal error: ErrorMessage replaces the
# whole app. MODE=error seeds the message.
REPO="$(cd "$(dirname "$0")/../../.." && pwd)"
cd "$(mktemp -d)" || exit 1
MODE=error exec python3 "$REPO/dev/harness/capture.py" \
  --cols 90 --rows 30 \
  --steps '[
    {"wait": 1.2},
    {"snap": "5.8-fatal-error"}
  ]' \
  -- bun --preload "$REPO/dev/harness/preload.ts" "$REPO/dev/harness/run.tsx"
