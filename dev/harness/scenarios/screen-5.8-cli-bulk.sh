#!/bin/sh
# Screen 5.8 (unchanged screens) — CLI bulk mode keeps the old
# BULK_DOWNLOAD_LAYOUT and exits when done. Also flow 9 (spec §8.3).
REPO="$(cd "$(dirname "$0")/../../.." && pwd)"
cd "$(mktemp -d)" || exit 1
MODE=clibulk exec python3 "$REPO/dev/harness/capture.py" \
  --cols 90 --rows 30 \
  --steps '[
    {"wait": 1.2},
    {"snap": "5.8-cli-bulk-running"},
    {"wait": 4.0},
    {"snap": "5.8-cli-bulk-complete"}
  ]' \
  -- bun --preload "$REPO/dev/harness/preload.ts" "$REPO/dev/harness/run.tsx"
