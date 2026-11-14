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

- **M4, the running guard moved into `startBulkDownload`** — as M3 recorded,
  §6.1 puts the "run already active" guard in the store action; the key
  router's own guard is gone and `b` now just calls `startBulkDownload()`.
  The warning (`Bulk download already running`) is unchanged. On start the
  action also sets `sidePanel = "queue"`, `browseFocus = "queue"` and
  `queueCursor = 0` when `!CLIMode`, and clears `bulkFailureReasons` so a new
  run cannot inherit the previous run's red rows.

- **M4, `x` after a settled run** — §4 says `x` works "only before a run
  starts; during a run render `x` dim and ignore". Read as: `x` is inert
  while a run is in flight (`bulkDownloadQueue.length > 0 &&
  !isBulkDownloadComplete`, the same "run active" condition used everywhere
  else) and live again once the run has settled. Post-settle the completed
  rows are deselected (nothing for `x` to remove, key no-ops there) and the
  failed rows are still selected, so `x` can drop one without reaching for
  `b`. The key also no-ops for rows that map to no selected entry.

- **M4, `bulkFailureReasons` lifecycle** — filled by `onBulkQueueItemFail`
  with the `summarizeFailures` string the flow already builds (the mock's
  reason row shows exactly that text, not the full `Couldn't download …`
  warning). `resetBulkQueueItems` drops the reasons of the items it resets,
  so a retried item does not show a stale red row under its ⋯/⠋ status; a
  fresh failure writes a fresh reason (last failure wins per MD5).

- **M4, `settleBulkRun` keeps entries with no queue outcome selected** —
  §6.1 says "remove completed entries, keep failed ones selected"; an entry
  that never entered the queue (no MD5 found at `b` time) has no outcome, is
  not completed, and stays selected. Settle runs after
  `writeBulkDownloadReports` at the end of `operateBulkDownloadQueue` when
  `!CLIMode`; CLI mode never settles (nothing interactive is selected).

- **M4, no speed anywhere** — §3 tells both the header variant and the queue
  panel to drop the speed term when it is not available and not to add speed
  tracking for this. Nothing tracks speed, so the header renders
  `bulk <bar 16> done/total · ✗ N failed` and the queue bars render `NN%`
  only.

- **M4, a failed queue row shows its size, not the mock's `retry r`** — §5.3's
  mock puts `retry r` where the size goes, but §3's prose fixes the row
  content as "status symbol, title, size". The prose wins; the retry
  affordance lives in the pinned hint (`r retry failed`) and the red reason
  row under the failure.

- **M4, queue-mode esc defers to the availability banner** — §4 rule 1 makes
  the banner own esc in list and queue modes (M3's recorded semantics); with
  the queue panel esc now meaning "back to list", the router skips its esc
  handling while `availabilityStatus.state !== "available"` so one esc stops
  the wait instead of also closing the panel. `v` still leaves the queue
  during a wait.

- **M4, queue-panel rows are grouped for scrolling** — the panel's content is
  built as groups (an item plus its bar/reason lines, or fixed lines:
  section headers, blanks, Saved to/Lists). The `queueCursor` window moves in
  groups so a scroll never separates an item from its bar or failure reason;
  it fills forward from the cursor first, then back, keeping the window full.
  The builder (`queue-rows.ts`) is shared by the panel and the key router, so
  the cursor's clamping and its x/d/space target cannot drift from what is
  rendered.

- **M4, pre-run queue section and direct rows** — before a run the Bulk
  section renders the bare `Bulk download` title (no `0 of 0` summary) over
  the selected entries with `●`. "Newest first" for direct downloads reads as
  the reversed insertion order of `downloadProgressMap` keys (a key enters
  when the download is queued); titles fall back to the entry id, a queue
  row's title/size come from `bulkDownloadSelectedEntries` by MD5 and fall
  back to the raw MD5 as §3 specifies.

- **M4, harness `MODE=clibulk` for the §5.8 CLI capture** — the CLI path
  enters via `renderTUI({startInCLIMode, initialLayout:
  BULK_DOWNLOAD_LAYOUT})` + `startBulkDownloadInCLI`, which the harness
  cannot reach through the interactive screen. clibulk seeds `CLIMode` and
  the old layout, then calls the real `startBulkDownloadInCLI` with an inline
  MD5 list against the fake download service (one `11…` MD5 fails, as in
  bulkfail); it skips `fetchConfig` and the file read, which need the
  network/filesystem. The run renders the unchanged old bulk screen, writes
  the MD5 list files to the cwd and exits via `handleExit`. Documented here
  rather than in `dev/README.md`, which is outside this ticket's file scope.

- **M5, the history push lives in `handleSearchSubmit`** — §5.4 puts the
  history push in `submitSearchFromBrowse`, but that would leave the
  session's first search (submitted from `SEARCH_LAYOUT`) out of the history,
  and §5.4's own mock shows the query that produced the current results as a
  history row. The push therefore happens in `handleSearchSubmit` after its
  min-chars guard; `submitSearchFromBrowse` delegates to it, and the
  double-push the browse path would otherwise make is absorbed by
  `pushSearchHistory`'s dedupe.

- **M5, search mode's focus lifecycle** — §4/§5.4 leave three small holes,
  filled as follows. `/` (list or queue mode) seeds `searchDraft` with the
  live query, so the input opens editing it in place. A submit sets
  `browseFocus` back to `"list"` (search is an editing mode; after `enter`
  the results load into the list). esc restores the live query into the draft
  before leaving, which is what "cancels and restores the previous query"
  observes.

- **M5, the history cursor is the draft itself** — no extra store field: ↑/↓
  walk `searchHistory` (newest first) by rewriting `searchDraft`, ↓ past the
  newest entry lands back on the live query, and the SearchHistory panel
  derives its `❯` from `searchHistory.indexOf(searchDraft)`, defaulting to
  row 0 while the draft is not in the history (which is exactly the §5.4
  mock's state: cursor on the first row while "python ty" is being typed).

- **M5, `ctrl+u` is deferred past the keypress** — `ink-text-input` also
  receives ctrl+u (Ink reports `input = "u"`, `key.ctrl`) and its handler
  inserts the letter; which of the two handlers runs first depends on
  subscription order, which reshuffles on every re-render. The router
  therefore queues the clear on a microtask, so it is always the last write
  of that keypress and no "u" survives the clear.

- **M5, the search line's right side swaps page info for the mock's hints** —
  §5.4's mock shows `enter search · esc cancel` right of the input on the
  search line itself, while §4's footer table gives search mode its own
  footer row. Both render: the page info is hidden while the input has the
  focus (the results are about to change anyway) and the footer shows
  `enter search  esc cancel  ↑↓ history  ctrl+u clear`.

- **M5, the SearchHistory panel fits its content to the panel height** — the
  first cut rendered the mock's full layout unconditionally and the stacked
  panel (5 content rows) flex-shrank the overflow into mangled output
  (dropped lines, eaten characters — Ink shrinks `Text` children of a
  fixed-height box). Like the queue panel, the content is now fitted: wide
  panels get the mock's full layout (title, blank, rows, blank, hint, blank,
  note, count); when that does not fit, the blank separators are dropped
  first, and only then are lines cut from the bottom.

- **M5, `returnToListKeepingFailedSelected` targets `BROWSE_LAYOUT`** — the
  old result-list layout is deleted (§6.3). The action is only reachable from
  the old bulk screen's after-complete options, which render when
  `!CLIMode && isBulkDownloadComplete` — unreachable since M4 moved
  interactive bulk runs in place — so the retarget only keeps the CLI-adjacent
  screen compiling; the queue integration test's expectation moved with it.

- **M5, harness `MODE=longtitle` for the §8.4 wrap edge** — the fake titles
  (~51 chars) never exceed a 60-column full-detail panel, so "long titles
  wrap in full detail" had no observable capture. longtitle seeds the browse
  screen directly (no search) with one entry whose title/author exceed every
  column and whose publisher/year/pages/language are empty, demonstrating the
  row truncation, the full-detail wrap and the `—` placeholder in one capture.
  Documented here rather than in `dev/README.md`, which is outside this
  ticket's file scope.

## Review-fix pass (branch `fix/review-findings`)

- **List mode's `r`** — §4's list table row is now wired: `r` in list mode
  calls the same guarded action queue mode's `r` uses (`isBulkDownloadComplete &&
  failedBulkDownloadItemCount > 0`, else no-op), so the help overlay's
  "Global: r retry failed downloads" row is true in both modes.

- **Priority rule 4 in `fullDetail`, and what "only q, ? work" means there** —
  the isLoading gate previously sat in the `list` and `queue` branches only;
  it now covers `fullDetail` too (help/quit/search stay exempt per the M3
  note). fullDetail binds neither `q` nor `?` of its own, so during a load the
  gate dispatches them straight to their global meanings — `q` → `requestQuit`,
  `?` → the help overlay — exactly what list/queue's handlers do with the same
  keys. Rule 4 says those keys *work* while `isLoading`, so "exempt from the
  gate but dead" would not satisfy it; outside a load fullDetail's keymap is
  unchanged (esc/enter/space/tab/d/↑↓ only).

- **Key-router split** — `use-browse-keys.ts` (550 lines) is now the router
  proper: store subscriptions, the per-keypress `KeyActions` object and the
  `useInput` switch with the loading gates. Siblings: `key-actions.ts` (the
  `KeyActions` contract), `list-keys.ts` (`handleListKeys` +
  `handleFullDetailKeys`, the two modes that act on the cursor entry),
  `queue-keys.ts` (`handleQueueKeys` + the queue/cursor model helpers and the
  queue/search-adjacent actions they need: `enterQueue`, `leaveQueue`,
  `moveQueueCursorBy`, `removeBulkUnderCursor`, `retryFailedBulk`,
  `actOnCursorRow`), `overlay-keys.ts` (`handleSearchKeys`/`handleHelpKeys`/
  `handleQuitKeys` plus the search actions). The router stays at 204 lines —
  under the review's "well under 300" bar — because the wiring closures read
  render-time snapshots (`currentPage`, `nextPageStatus`, `searchValue`,
  `bulkDownloadSelectedEntries`) that a deeper factory would have to thread
  through a deps interface for no behavioural gain.

- **Delegation wrappers removed** — `startBulkDownload`,
  `searchHistoryUp`/`Down` (now the store's `searchHistoryPrevious`/`Next`
  directly) and `downloadEntry` are wired as plain store-action references;
  wrappers remain only where they add something (`prevPage`'s page-1 guard,
  `openHelp`'s overlay argument, `actOnCursorEntry`'s snapshot-bound toggle).

- **Shared status map** — `status-symbol.ts` holds the §3 glyph table
  (`STATUS_SYMBOLS`, one entry per `DownloadStatus`) plus `SPINNER_SYMBOL`
  (moved here from row-status.ts) and `BULK_SELECTED_SYMBOL` (● yellow —
  membership, not a run state). `rowStatus` consumes it for every fixed glyph
  (DOWNLOADING stays special: the row renders the live percent and borrows
  only the colour), `queue-rows.ts`'s `queueItemStatus` switch is gone — the
  two item-line call sites read the map directly, byte-identical output — and
  the status header's segments and the bulk-run `✗ N failed` tail are built
  from it.

- **Header labels** — the status header's user-facing strings moved to
  `labels.ts`: `STATUS_SUMMARY_{DOWNLOADING,QUEUED,IN_BULK,DONE,FAILED}`,
  `STATUS_SUMMARY_SEPARATOR` (` · `) and `STATUS_BULK_RUN_PREFIX` (`bulk `,
  trailing space included so the width math derives from the label).

- **Shared border arithmetic** — `panel-border.ts` exports `borderTopTail`
  (dashes + `─╮`, optional ` <marker> ─╮` when a marker sits in the line);
  results-panel, full-detail-panel and side-panel (both its tab and Search
  variants) consume it. side-panel's tabs row renders exactly as before — the
  `Detail │ Queue N` tabs string is only used for the width math.

- **queue-rows split** — types (`QueueLine`, `QueueGroup`, `QueueActionRow`,
  `QueueModel`, `QueueModelContext`) and the item-line builder (`itemLines`,
  shared by the bulk and direct sections) live in `queue-model.ts`, the scroll
  window in `queue-scroll.ts`; `queue-rows.ts` keeps `buildQueueModel` and
  re-exports `visibleQueueGroups`/`QueueLine`/`QueueModel` so `queue-panel.tsx`
  and the router keep their one-line imports.

- **`headerLine` moved to `result-row.tsx`** — beyond the letter of the
  findings, driven by the ≤~160-lines bar: the column-header row is built from
  the same widths and `fitCell` rules as the rows, so it belongs beside
  `ResultRow`. Pure move, output unchanged (harness byte-compare).

- **New tests** — `test/status-symbol.test.ts` pins the shared glyph table
  (§3 authority), `test/queue-keys.test.ts` pins the moved queue helpers'
  guards (retry's settled+failed condition, `x`'s before-a-run-only rule,
  cursor clamping, space/d acting on the mapped entry), and
  `test/list-keys.test.ts` pins list-mode `r` → retry, the exact-case `R`
  no-op and fullDetail's esc/enter/d behaviour. The row-status, queue-count
  and layout-metrics suites pass unchanged.
