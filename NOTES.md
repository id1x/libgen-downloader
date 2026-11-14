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

- **M2, `computeLayout` takes the terminal width** — M1's caller passed
  `terminalColumns - 1` (the padding column), so the §3 breakpoints tested
  the usable width and a 100-column terminal laid out stacked. `computeLayout`
  now receives the terminal width: breakpoints test it directly, panel widths
  share `terminal - 1` (§5.1's `1 + 66 + 53 = 120` puts the padding column in
  the side panel's share), so a 100-column terminal is wide (56 + 43) and
  every M1-era capture renders unchanged. M1's width expectations moved by
  that same padding column (99→98, 59→58, 44→43).

- **M2, `rowStatus` joins the bulk run outcome for `DOWNLOADED` only** — a
  bulk-selected entry whose MD5 has a terminal outcome in `bulkDownloadQueue`
  shows ✓ when the run downloaded it (pre-`settleBulkRun` window), but keeps
  ● when it failed, because §8.3 says "the failed item stays ●" and it stays
  selected for `r`. Non-terminal bulk outcomes never change the row (the
  table's ● row). Recorded so M4 does not re-derive this.

- **M2, the "spinner" row label is a static `⠋` frame** — §3's table gives no
  symbol for CONNECTING/PROCESSING/FETCHING. A live `ink-spinner` per row
  would fight the row memoisation (§8.4 key repeat), so `rowStatus` returns a
  static frame with `kind: "spinner"`; a caller that wants animation can
  swap the symbol by kind.

- **M2, `KeyFooter` separator is two spaces** — the component rendered one
  space between hint pairs while its own width budget (and §4's footer format
  strings, e.g. `space bulk  d download`) assume two. Fixed to match; footers
  and the detail panel's pinned hint now render as the mockups show.

- **M2, header summary is right-aligned** — §3 says "Right: a live summary";
  M1 rendered it left-hugging right after the mirror host. The summary now
  pads to the right edge (truncated with the host when the terminal is too
  narrow), and the `│  ` separator uses §3's two-space form.

- **M2, `MODE=statuses` and a capture.py `resize` step** — M2 wires no
  download/bulk keys yet (they arrive in M3/M4), so no key path can produce a
  downloading row for the §5.1 capture. `MODE=statuses` seeds the store after
  the fashion of §5.1's mix (item 1 done, 2 downloading 42%, 4 queued, 9
  failed, 3/5/7 bulk-selected) using the deterministic fake entries; it is
  store seeding only, no new fake behaviour. `capture.py` gained a
  `{"resize": [cols, rows]}` step (TIOCSWINSZ + pyte screen resize) to verify
  live-on-resize relayout. `dev/README.md` is outside this ticket's file
  scope, so the new mode is documented here instead of there.

- **M2, the `v` border hint renders but the key stays unwired** — §7
  schedules `v` toggling in M4; the hint is display-only this milestone.

- **M2, stacked detail reserves lines 3–4** — the §3 stacked compression
  reads as a fixed 5-line body: the download block's rows (bar + bytes, or
  one status line padded to two, or two blanks when there is no direct
  status) always occupy lines 3–4 so the bulk line stays on line 5 and the
  panel never reflows.

- **M3, `b` does not set `browseFocus = "queue"`** — §4's table says `b` runs
  `startBulkDownload()` and then sets the focus to `queue`, but at this
  milestone the run still lands on the old bulk screen, whose own components
  own the keys from there. Setting the focus now would leave a stale `queue`
  value behind when the old flow returns (it never resets `browseFocus`), so
  the hand-off moves to M4 together with the Queue panel. Also, the "run
  already active" guard (`bulkDownloadQueue.length > 0 &&
  !isBulkDownloadComplete`) lives in the key router for now; M4 moves it into
  `startBulkDownload` per §6.1.

- **M3, priority rule 4's gate is list-mode-only** — §8.3 flow 7 requires esc
  to close the help overlay while the outage wait runs, and during that wait
  `isLoading` stays true. The "only q, ?, ctrl+c" gate therefore sits inside
  the `list` branch of the router; overlay modes keep their own keys live.
  The banner keeps owning esc in list/queue regardless of loading (its own
  `isActive`, unchanged semantics).

- **M3, overlays replace the main area (§5.5's first option)** — the centred
  box takes the main area's rows via justifyContent/alignItems; the search
  line, warning and banner dim behind it. Ink 6 puts `dimColor` on `Text`
  only, so the chrome pieces take a `dimmed` prop instead (the spec's
  alternative). The footer shows the overlay mode's own hints and stays
  undimmed; the app header (rendered by `app.tsx` above this layout) stays
  undimmed too. The overlay budget is the full main area
  (`computeLayout(..., hasSidePanel: false)`), so a banner's five reserved
  rows shrink the help box and it truncates with `…`.

- **M3, quit-prompt wording follows §5.6's counting rule over the mockup's
  shorter line** — "N download(s) still running or queued" renders as
  "1 download is still running or queued" / "N downloads are still running or
  queued"; the bulk-queue line follows the mockup ("N item(s) are in the bulk
  queue"); a running run renders "Bulk download is N/M done". The box is 50
  columns (the mock's content lines are 50 wide; its top border row is drawn
  one column wider than its content — content wins). The explanation renders
  as the mockup's two lines. When the box does not fit, blank separators go
  first, then the content truncates with `…`.

- **M3, `requestQuit`'s pending definition** — §4's table names a direct
  download active/queued and a non-empty bulk selection; the ticket adds a
  running bulk run. Implemented as: `inDownloadQueueEntryIds.length > 0`, or
  the selection is non-empty, or `bulkDownloadQueue.length > 0 &&
  !isBulkDownloadComplete` (the same condition M4's `startBulkDownload` guard
  will use). A finished run with a still-non-empty selection therefore opens
  the prompt, but its bulk-queue line does not render (§5.6 only shows the
  line while the run has not finished).

- **M3, `enter` requires an entry under the cursor** — on an empty results
  list enter is a no-op; there is no detail to show. §8.4's zero-results row
  only promises that `/` and `q` still work.

- **M3, the full-detail marker uses the live count** — §5.7's `Detail  N/25`
  renders as `Detail  <cursor+1>/<entries.length>` (the same count the
  results panel's position marker shows), not a hard-coded 25.

- **M3, `/` and `v` stay unwired** — search focus is M5 and `v` toggling is
  M4; the footer hints already render both and the keys are intentionally
  dead until then (like M2's `v` border hint).

- **M3, harness `MODE=outage` now drives the real recovery flow** — flow 7's
  "second esc stops waiting" needs an observable stop: with only a seeded
  `availabilityStatus` there is no owning flow, so `stopWaitingForLibgen`
  changes nothing on screen. The fake search in outage mode now returns
  `connection_error`, the real `SearchFlow` failovers and starts a live wait
  (the banner's counters tick), and stopping the wait gives up into the
  fatal-error screen. The seeded waiting status is kept as the pre-show
  (supersedes the M0 note's outage description).
