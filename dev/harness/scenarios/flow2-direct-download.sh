#!/bin/sh
# Flow 2 — direct download (spec §8.3.2): d shows the row's NN% and the
# detail panel's bar; a second d while the first runs shows ⋯ until it
# starts; finished rows show ✓. A third d on the finished first row restarts
# it and the status goes back to ⋯ (spec §8.4).
REPO="$(cd "$(dirname "$0")/../../.." && pwd)"
cd "$(mktemp -d)" || exit 1
exec python3 "$REPO/dev/harness/capture.py" \
  --cols 120 --rows 36 \
  --steps '[
    {"wait": 1.2},
    {"keys": "master", "after": 0.2},
    {"keys": "\r", "after": 2.4},
    {"keys": "d", "after": 0.8},
    {"snap": "flow2-first-downloading"},
    {"keys": "\u001b[B", "after": 0.2},
    {"keys": "d", "after": 0.4},
    {"snap": "flow2-second-queued"},
    {"wait": 3.4},
    {"snap": "flow2-first-done-second-running"},
    {"wait": 3.0},
    {"snap": "flow2-both-done"},
    {"keys": "\u001b[A", "after": 0.2},
    {"keys": "d", "after": 0.6},
    {"snap": "flow2-re-download"}
  ]' \
  -- bun --preload "$REPO/dev/harness/preload.ts" "$REPO/dev/harness/run.tsx"
