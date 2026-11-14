#!/bin/sh
# Screen 5.4 — search focused at 120x36 (spec §5.4): the results panel dims,
# the side panel shows the Search tab with the session history and the kept
# bulk-selections note. Two in-place searches fill the history first.
REPO="$(cd "$(dirname "$0")/../../.." && pwd)"
cd "$(mktemp -d)" || exit 1
exec python3 "$REPO/dev/harness/capture.py" \
  --cols 120 --rows 36 \
  --steps '[
    {"wait": 1.2},
    {"keys": "master", "after": 0.2},
    {"keys": "\r", "after": 2.4},
    {"keys": " ", "after": 0.3},
    {"keys": "/", "after": 0.4},
    {"keys": "\u0015", "after": 0.3},
    {"keys": "detail", "after": 0.3},
    {"keys": "\r", "after": 2.4},
    {"keys": "/", "after": 0.5},
    {"snap": "5.4-search-focused"}
  ]' \
  -- bun --preload "$REPO/dev/harness/preload.ts" "$REPO/dev/harness/run.tsx"
