#!/bin/sh
# Flow 7 — overlays (spec §8.3.7). First run: ? opens help, esc closes it.
# Second run (MODE=outage): after the real recovery flow fails over and
# starts its live wait (the fake mirrors burn their retry attempts first,
# so the wait starts ~20s in), esc with help open closes only the help (the
# wait keeps running), a second esc stops the wait and gives up into the
# fatal-error screen.
REPO="$(cd "$(dirname "$0")/../../.." && pwd)"
cd "$(mktemp -d)" || exit 1

python3 "$REPO/dev/harness/capture.py" \
  --cols 80 --rows 30 \
  --steps '[
    {"wait": 1.2},
    {"keys": "master", "after": 0.2},
    {"keys": "\r", "after": 2.4},
    {"keys": "?", "after": 0.5},
    {"snap": "flow7-help-open"},
    {"keys": "\u001b", "after": 0.5},
    {"snap": "flow7-help-closed"}
  ]' \
  -- bun --preload "$REPO/dev/harness/preload.ts" "$REPO/dev/harness/run.tsx"

echo "=== MODE=outage run ==="

MODE=outage python3 "$REPO/dev/harness/capture.py" \
  --cols 80 --rows 30 \
  --steps '[
    {"wait": 1.2},
    {"keys": "master", "after": 0.2},
    {"keys": "\r", "after": 20.0},
    {"snap": "flow7-outage-wait-running"},
    {"keys": "?", "after": 0.5},
    {"snap": "flow7-help-during-outage"},
    {"keys": "\u001b", "after": 0.5},
    {"snap": "flow7-help-closed-wait-running"},
    {"keys": "\u001b", "after": 2.0},
    {"snap": "flow7-wait-stopped"}
  ]' \
  -- bun --preload "$REPO/dev/harness/preload.ts" "$REPO/dev/harness/run.tsx"
