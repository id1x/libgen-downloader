#!/bin/sh
# Screen 5.8 (unchanged screens) — the pre-search screen keeps SEARCH_LAYOUT
# (header plus `? Search:` input), captured at 90x30.
REPO="$(cd "$(dirname "$0")/../../.." && pwd)"
cd "$(mktemp -d)" || exit 1
exec python3 "$REPO/dev/harness/capture.py" \
  --cols 90 --rows 30 \
  --steps '[
    {"wait": 1.2},
    {"snap": "5.8-search-screen"}
  ]' \
  -- bun --preload "$REPO/dev/harness/preload.ts" "$REPO/dev/harness/run.tsx"
