#!/bin/sh
# Flow 5 — search in place (spec §8.3.5): / focuses the input, esc restores
# the previous query, then a new query runs without leaving the browse screen
# and the bulk count is unchanged.
REPO="$(cd "$(dirname "$0")/../../.." && pwd)"
cd "$(mktemp -d)" || exit 1
exec python3 "$REPO/dev/harness/capture.py" \
  --cols 120 --rows 36 \
  --steps '[
    {"wait": 1.2},
    {"keys": "master", "after": 0.2},
    {"keys": "\r", "after": 2.4},
    {"keys": " ", "after": 0.4},
    {"snap": "flow5-selected"},
    {"keys": "/", "after": 0.4},
    {"keys": "xxx", "after": 0.3},
    {"snap": "flow5-typed"},
    {"keys": "\u001b", "after": 0.5},
    {"snap": "flow5-esc-restored"},
    {"keys": "/", "after": 0.4},
    {"keys": "\u0015", "after": 0.3},
    {"keys": "detail", "after": 0.3},
    {"keys": "\r", "after": 2.6},
    {"snap": "flow5-new-results"}
  ]' \
  -- bun --preload "$REPO/dev/harness/preload.ts" "$REPO/dev/harness/run.tsx"
