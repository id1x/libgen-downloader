#!/bin/sh
# Flow 4 — pagination (spec §8.3.4). First run (normal): → pressed while the
# next-page check is in flight is ignored (the list stays on page 1 with no
# loading skeleton), once the check is ready → loads page 2 with the cursor
# at 0, ← returns to page 1. Second run (MODE=nextfail): → re-checks the
# failed page instead of failing — the list stays on page 1 and a later →
# still tries again.
REPO="$(cd "$(dirname "$0")/../../.." && pwd)"
cd "$(mktemp -d)" || exit 1

python3 "$REPO/dev/harness/capture.py" \
  --cols 120 --rows 36 \
  --steps '[
    {"wait": 1.2},
    {"keys": "master", "after": 0.2},
    {"keys": "\r", "after": 1.2},
    {"keys": "\u001b[C", "after": 0.3},
    {"snap": "flow4-checking-ignored"},
    {"wait": 1.0},
    {"keys": "\u001b[C", "after": 2.0},
    {"snap": "flow4-page2"},
    {"keys": "\u001b[D", "after": 2.0},
    {"snap": "flow4-back-to-page1"}
  ]' \
  -- bun --preload "$REPO/dev/harness/preload.ts" "$REPO/dev/harness/run.tsx"

echo "=== MODE=nextfail run ==="

MODE=nextfail python3 "$REPO/dev/harness/capture.py" \
  --cols 120 --rows 36 \
  --steps '[
    {"wait": 1.2},
    {"keys": "master", "after": 0.2},
    {"keys": "\r", "after": 2.6},
    {"snap": "flow4-nextfail-page1"},
    {"keys": "\u001b[C", "after": 0.4},
    {"snap": "flow4-nextfail-recheck"},
    {"wait": 1.2},
    {"keys": "\u001b[C", "after": 0.4},
    {"snap": "flow4-nextfail-recheck-again"}
  ]' \
  -- bun --preload "$REPO/dev/harness/preload.ts" "$REPO/dev/harness/run.tsx"
