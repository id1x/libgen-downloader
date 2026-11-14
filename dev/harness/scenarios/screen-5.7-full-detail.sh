#!/bin/sh
# Screen 5.7 — the full-screen detail at 120x36 (spec §5.7): the wide Detail
# panel's content as one full-width bordered panel titled `Detail  N/25`,
# long values wrapping instead of truncating.
REPO="$(cd "$(dirname "$0")/../../.." && pwd)"
cd "$(mktemp -d)" || exit 1
exec python3 "$REPO/dev/harness/capture.py" \
  --cols 120 --rows 36 \
  --steps '[
    {"wait": 1.2},
    {"keys": "master", "after": 0.2},
    {"keys": "\r", "after": 2.4},
    {"keys": "\r", "after": 0.5},
    {"snap": "5.7-full-detail"}
  ]' \
  -- bun --preload "$REPO/dev/harness/preload.ts" "$REPO/dev/harness/run.tsx"
