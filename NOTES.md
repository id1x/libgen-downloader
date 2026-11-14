# NOTES

Decisions where the master/detail TUI redesign spec (#6) conflicted with the
code or left a case unclear. Smallest-change choices, newest last.

- **M0, `dev/harness/preload.ts` filter** — the spec gives the stub plugin
  verbatim with `filter: /libgen-downloader\/src\/index\.ts$/`. That only
  matches checkouts whose directory is literally named `libgen-downloader`;
  sandbox worktrees are not (e.g. `…/worktree/<id>/m0-groundwork`), which
  would leave the safety net dead. Broadened to `/src\/index\.ts$/` (still
  only matches this repo's entry module). Everything else stays verbatim.

- **M0, `MODE=failover`** — spec §8.1 says failover "sets `mirrorCheckStates`
  and `connectionError`". Seeding alone is invisible: the fields only render
  in the result-list loading skeleton, and a succeeding fake search clears
  them via `SearchFlow.showResults()`. In failover mode the fake search
  therefore hangs (as in `slow`) so the connection-error + mirror-failover
  skeleton (§5.8) stays on screen.

- **M0, `dev/` and the repo checks** — `tsconfig.json` `include` covers
  `src/test/scripts` and the `lint`/`format` globs match the same sets, so
  `dev/harness/*` is transpiled by Bun only and is not typechecked or linted
  by repo scripts. Left the configs untouched (smallest change) and verified
  the harness files manually with `tsc --noEmit` under the project's compiler
  options — no errors against the real store types.

- **M0, no new unit tests** — the ticket's file scope excludes `test/`, and
  §8.2's unit tests target pure helpers that only exist from M1 on
  (`computeLayout`, `rowStatus`, cursor helpers). M0's acceptance check is the
  harness: search, results and detail screens captured at 90×30 via
  `capture.py`.

- **M1, `app.tsx` branches for the browse screen** — §6.1 only moves
  `DownloadIndicator`, the warning and the header out of the browse screen's
  way, but the browse layout also renders `AvailabilityBanner` itself (§6.2
  `index.tsx`: "warning, banner and footer"), so the app gates the banner to
  non-browse layouts exactly like the warning. The browse branch renders
  outside `AppContainer`: `AppContainer` caps the app at 80 columns
  (`SCREEN_BASE_APP_WIDTH`), which would make the ≥100-column responsive
  layout unreachable. Old layouts keep the capped container unchanged.

- **M1, `use-stdout-dimensions` rows init** — the hook initialised `rows`
  from `stdout.columns` and only corrected them on a `resize` event. The
  harness pty sets the window size before the child starts, so no resize
  event ever fires and the browse layout's vertical math would run with
  `rows = columns` (90 rows at a 30-row terminal). Initialised `rows` from
  `stdout.rows`; old layouts don't read rows, so they are unaffected.

- **M1, `computeLayout` opts gain `hasSidePanel`** — §3's responsive table
  sizes the stacked results panel as "main area minus the detail panel", but
  the side panel doesn't exist until M2; subtracting its 7 rows in M1 would
  leave a hole under the list at 60–99 columns. `computeLayout(columns,
  rows, opts)` therefore takes `hasSidePanel` (M1 passes `false`; the
  results panel takes the whole main area) and `sidePanel` (Detail 7 rows,
  Queue 12). All other numbers follow §3/§8.2.

- **M1, "author 14 when wide space is short"** — read as: in wide mode, when
  the title column would fall under 10 cells with a 16-cell author column,
  the author column drops to 14. Stacked mode keeps 16; compact hides the
  author column entirely.

- **M1, harness fake search honours the query** — M0's fake search ignored
  the query, so no input could reach §8.4's zero-results state, which the
  ticket requires capturing. The fake search now matches the query against
  the fake titles (case-insensitive substring): matching queries ("book",
  "Simulated") return 25 entries per page as before, anything else returns
  an empty page. `dev/README.md` updated; results captures use title
  substrings, not topic words like "python".

- **M1, header summary counts come from `downloadProgressMap`** — the
  header's ✓/✗ counts read the progress map (records persist after a
  download settles) rather than the session counters, so the header agrees
  with the rows it summarises (§8.5). Non-terminal in-flight statuses
  (connecting/processing/fetching/waiting) count as "queued".

- **M1, old result-list screen is dead but compilable** — with
  `setEntries()` no longer building `listItems`, anything that still routes
  to `RESULT_LIST_LAYOUT` (e.g. `returnToListKeepingFailedSelected()` after
  a bulk run) renders an empty list. It is unreachable from the M1
  interactive flow (bulk still uses the old screens only after `b`, which is
  unwired until M3); §6.1 orders the `setEntries()` change in M1 and the
  deletion in M5. `test/search.integration.test.ts` now expects
  `BROWSE_LAYOUT` after `handleSearchSubmit()` (§6.1).
