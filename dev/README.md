# dev/

Development tooling that is not shipped with the package. Nothing under `dev/`
is part of the built CLI.

## harness/ — mock TUI harness

The mock harness renders the real `<App>` (Ink TUI) with faked store actions so
screens can be inspected and captured without any network access
(spec: "master/detail TUI redesign", §8.1).

| File | Purpose |
| --- | --- |
| `preload.ts` | Bun plugin stubbing `src/index.ts` (which runs `operate()` on import) as a safety net; nothing should import it since `src/version.ts` exists. |
| `run.tsx` | Seeds the zustand store (`useBoundStore.setState`) with three fake mirrors, a fake `search` (700 ms delay, 25 fake entries per page for pages 1–3) and a fake recovering download service (10 × 250 ms data chunks), then renders `<App doNotFetchConfigInitially>`. |
| `capture.py` | Drives the harness inside a pseudo-terminal (via `pty.fork` + `TIOCSWINSZ`) and prints screen snapshots using [pyte](https://pypi.org/project/pyte/). |

### Running the harness

Run it from an **empty temporary directory**, so the MD5 list files that bulk
downloads write to `process.cwd()` do not land in the repository:

```sh
cd "$(mktemp -d)"
bun --preload <repo>/dev/harness/preload.ts <repo>/dev/harness/run.tsx
```

`MODE` env selects a scenario (default `normal`):

| MODE | Behaviour |
| --- | --- |
| `normal` | Search returns 25 fake entries per page (pages 1–3); downloads finish. |
| `slow` | Search never returns (loading skeleton stays up). |
| `nextfail` | Pages > 1 return an error result (next-page check fails). |
| `bulkfail` | MD5s starting with `11` fail with an `unreachable` failure. |
| `freeze` | Downloads stall at 40% and never finish. |
| `failover` | Seeds `connectionError` + `mirrorCheckStates` and hangs the search, so the loading skeleton shows the connection-error / mirror-failover screen. |
| `outage` | Seeds a `waiting` availability status (magenta banner renders). |
| `error` | Seeds `errorMessage` (full-screen error replacement). |

### Capturing screens

```sh
pip install pyte
cd "$(mktemp -d)"
python3 <repo>/dev/harness/capture.py \
    --cols 90 --rows 30 \
    --steps '[
      {"wait": 1.5},
      {"keys": "python", "after": 0.3},
      {"keys": "\r", "after": 2.5},
      {"snap": "results"}
    ]' \
    -- bun --preload <repo>/dev/harness/preload.ts <repo>/dev/harness/run.tsx
```

Step grammar (a JSON list):

- `{"wait": seconds}` — pause, keeps draining the terminal output.
- `{"keys": "...", "after": seconds}` — write keys, then pause
  (`after` defaults to 0.2 s). Optional `"delay"` overrides the per-key gap
  (default 0.03 s).
- `{"snap": "name"}` — drain output and print the screen (trailing whitespace
  trimmed).

Key escapes: down `\u001b[B`, up `\u001b[A`, right `\u001b[C`, left
`\u001b[D`, enter `\r`, tab `\t`, esc `\u001b`, PgDn `\u001b[6~`.

Ink parses one keypress per stdin chunk, so `capture.py` writes each key (or
escape sequence) as its own write, paced like real typing. Never paste several
escape sequences and rely on them arriving as separate keypresses — that is
what the pacing is for.

Driving today's (pre-redesign) UI: the `❯` cursor is always on the 4th
rendered row of the result list; `j`/`k`/arrows rotate the list window under
it. Press `enter` on an entry to expand its menu, `enter` again to pick
`See Details` (the first menu option).

Snapshots for each section-5 screen of the redesign spec are kept in
`dev/harness/scenarios/` as they become relevant (from M1 on).
