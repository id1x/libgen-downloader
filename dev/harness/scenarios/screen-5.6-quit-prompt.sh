#!/bin/sh
# Screen 5.6 — the quit prompt at 80x30 (spec §5.6). MODE=freeze keeps a
# direct download running so the prompt has all its lines; n returns to the
# browse screen.
REPO="$(cd "$(dirname "$0")/../../.." && pwd)"
cd "$(mktemp -d)" || exit 1
MODE=freeze exec python3 "$REPO/dev/harness/capture.py" \
  --cols 80 --rows 30 \
  --steps '[
    {"wait": 1.2},
    {"keys": "master", "after": 0.2},
    {"keys": "\r", "after": 2.4},
    {"keys": "d", "after": 1.0},
    {"keys": " ", "after": 0.3},
    {"keys": "q", "after": 0.5},
    {"snap": "5.6-quit-prompt"},
    {"keys": "n", "after": 0.5},
    {"snap": "5.6-stay"}
  ]' \
  -- bun --preload "$REPO/dev/harness/preload.ts" "$REPO/dev/harness/run.tsx"
