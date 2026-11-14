#!/bin/sh
# Screen 5.1 — wide browse with the Detail panel at 120x36 (spec §5.1).
# MODE=statuses seeds the §5.1 status mix (done, downloading, queued, failed,
# bulk-selected rows).
REPO="$(cd "$(dirname "$0")/../../.." && pwd)"
cd "$(mktemp -d)" || exit 1
MODE=statuses exec python3 "$REPO/dev/harness/capture.py" \
  --cols 120 --rows 36 \
  --steps '[
    {"wait": 1.2},
    {"keys": "master", "after": 0.2},
    {"keys": "\r", "after": 2.4},
    {"snap": "5.1-wide-browse"}
  ]' \
  -- bun --preload "$REPO/dev/harness/preload.ts" "$REPO/dev/harness/run.tsx"
