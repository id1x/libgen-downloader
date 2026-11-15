# Behavioral surface — parity checklist for the Rust rewrite

Ticket: id1x/libgen-downloader#20 ("What is the full behavioral surface the rewrite must match?").
Parent map: #13. This file is the parity checklist source the ticket asked for: **behavior → where implemented in the current TS app → observable contract**. The rewrite must reproduce the observable contract column; the "where" column is only a pointer, since the rewrite is a fresh internal architecture.

**Source revision:** `feat/master-detail-tui` @ `77eb40e` ("fix: degrade resolution failures instead of crashing the app"), investigated in the working checkout at `/Users/idries/projects/libgen-downloader`. That branch is master (`f5b0598`) + 8 commits; the master/detail TUI (browse screen, queue panel, search history) exists only there. Two untracked files in that checkout (`test/zz-soak-banner.tsx`, `test/zz-soak-bulk.tsx`) are throwaway soak harnesses and are excluded from the inventory.

Counting convention: each `B#` is one user-visible behavior. **104 behaviors enumerated** (some entries bundle a tight cluster of sub-cases; the count is the number of checklist rows below).

---

## 1. CLI surface

| # | Behavior | Where | Observable contract |
|---|---|---|---|
| B1 | Binary + no-flag mode | `package.json` (`bin`), `src/index.ts`, `src/cli/index.ts` | `libgen-downloader` with no flags starts the interactive TUI in search-screen mode; config is fetched on mount. |
| B2 | `-s, --search <query>` | `src/cli/operate.ts:32-48` | Query shorter than 3 chars → prints `Query must be at least 3 characters long` to stdout and exits (no TUI). Otherwise: fetch config, seed the search value, render the TUI, then immediately run the search — the user lands on the browse screen in the loading state. |
| B3 | `-b, --bulk <MD5LIST.txt>` | `src/cli/operate.ts:50-63`, `src/tui/store/bulk-download-queue.ts:359` | Reads the file as UTF-8, splits on `\n`, drops blank lines (`trim()` test — but **keeps** any `\r` on non-blank lines: a CRLF list yields md5 values with trailing `\r`, a quirk to preserve-or-fix consciously). Fetches config, renders the TUI in CLI mode directly on the bulk-download layout, runs the bulk queue, and calls `process.exit(0)` when the run completes. |
| B4 | `-u, --url <MD5>` | `src/cli/operate.ts:65-81`, `resolveURLWithRecovery` | Pure console mode (no TUI). Prints `Fetching config...`, then `Finding download url...`. On success prints `Here is the direct download link:` followed by the resolved URL. On failure prints `Failed to find download url: <summarizeFailures>`. While waiting out an outage prints `<failure description> (<reason>). Waiting for it to come back, up to 1m 30s per book...` and on recovery `libgen is reachable again via <hosts>, retrying...`. |
| B5 | `-d, --download <MD5>` | `src/cli/operate.ts:83-95` | Identical to `-b` with a one-element md5 list (CLI bulk layout, exits at completion). |
| B6 | `-h, --help` (+ meow `--version`) | `src/cli/index.ts` | Help text is the literal template in `cli/index.ts` (including the typo "witout" and the stale example file name `MD5_LIST_1695686580524.txt` — see §19 drift note). meow also auto-answers `--version` from `package.json`. |
| B7 | User-Agent | `src/settings.ts:19`, `src/api/http/libgen-http-client.ts` | Every HTTP request sends `User-Agent: libgen-downloader/<version>` (version 3.4.0 today). |
| B8 | Exit code path | `src/tui/store/events.ts:194-197` | All normal exits funnel through `handleExit()` → `process.exit(0)`. |

## 2. Startup & remote config

| # | Behavior | Where | Observable contract |
|---|---|---|---|
| B9 | Config URL | `src/settings.ts:9-10`, `src/api/data/remote-config.ts` | Fetches `https://raw.githubusercontent.com/obsfx/libgen-downloader/configuration/config.v3.json`. Any fetch failure becomes `ConfigFetchError` → store error message `Couldn't fetch the config`. |
| B10 | Config keys | `src/api/data/remote-config.ts:54-64`, `src/api/data/types.ts` | Payload keys consumed: `latest_version` (string, optional), `mirrors` (list of `{src, type}`), `download_mirrors` (same shape). Everything else in the payload is ignored. |
| B11 | Mirror entry validation | `remote-config.ts:66-84` | A mirror is kept only if `src` is a string that `URL.canParse` accepts and `type` ∈ {`libgen-plus`, `libgen-spa`}; non-array fields become empty lists. Invalid entries are silently dropped. |
| B12 | Search-mirror selection | `src/tui/store/config.ts:55-97` | Loader messages while starting: `Fetching configuration file...` then `Finding an available mirror...`; per failed mirror `Couldn't reach to mirror, <src>. Finding an available mirror...`. The first mirror whose base URL answers a plain GET wins and becomes the active search mirror. None reachable → error `Couldn't find a working mirror`. |
| B13 | Download-mirror list | `config.ts:91-96`, `src/tui/store/utils/mirrors.ts` | Download sources = `[active mirror, ...mirrors, ...download_mirrors]` deduped by `src` (first occurrence wins, order preserved). |
| B14 | Adapter factory constraint | `src/api/adapters/index.ts` | Only `libgen-plus` gets a search adapter; `libgen-spa` reaches `UnknownMirrorTypeError` (`Unknown mirror type: <type>`) if it were chosen as the search mirror. In practice spa mirrors are download-source-only. **Parity note:** the Rust rewrite must keep spa mirrors usable as download sources even though they can never be the search mirror. |
| B15 | Update notice | `config.ts` (latestVersion), `src/tui/components/app-header.tsx` | When `latest_version` is a non-empty string ≠ running version, a second header row renders `New version available: → @<version> run npm i -g libgen-downloader to update` on both the search/bulk screens and the browse screen. |

## 3. "Settings" — constants and persisted state

**Finding the ticket explicitly asks to flag:** `src/settings.ts` contains **compile-time constants, not user settings**. There is no user settings file anywhere in the app — no read/write of user preferences exists. The persisted state surface is exactly: the learned-selector cache, the md5-list output files, and one env override.

| # | Behavior | Where | Observable contract |
|---|---|---|---|
| B16 | Request defaults | `src/settings.ts:12-14`, `src/utilities.ts` (`attempt`) | Generic HTTP retry wrapper defaults: 5 attempts, 2 000 ms between attempts, 10 000 ms per-attempt timeout (timeout aborts with `OperationTimeoutError`, name `TimeoutError`; a fresh signal per attempt). Used for search pages, config load, mirror probes. |
| B17 | Search paging size | `src/settings.ts:16` | `SEARCH_PAGE_SIZE = 25` → every search URL requests 25 results (`res=25`). |
| B18 | Download attempt policy | `src/settings.ts:21-23` | Per download source: 2 attempts, 30 s timeout. `BULK_RETRY_PASSES = 1` — one automatic retry pass over failed bulk items after the first pass. |
| B19 | Recovery/backoff policies | `src/settings.ts:25-34` | libgen recovery backoff = mirror cooldown backoff: initial 15 s, ×2 growth, 300 s cap, ±20 % jitter. Health-check timeout 20 s. `CLI_MAX_LIBGEN_WAIT_MS` = 30 min (CLI search wait deadline), `MAX_BOOK_WAIT_MS` = 90 s (per-book download recovery deadline). |
| B20 | Learned-selector persistence | `src/api/services/app-services.ts:42-44`, `src/api/resolution/utils/files.ts`, `src/api/resolution/store/file-selector-store.ts`, `store/selector-store.ts` | The only persisted app state. JSON file at `<cache>/libgen-downloader/selectors.json`. Cache dir: `LIBGEN_DOWNLOADER_CACHE_DIR` env override, else `~/Library/Caches/libgen-downloader` (macOS), `%LOCALAPPDATA%\libgen-downloader` (Windows), `$XDG_CACHE_HOME\|-/.cache/libgen-downloader` (other). Format: object keyed `` `<host>|<task>` `` (task ∈ `download-link` \| `results-table`) → `{path: [{tag, nth}...], learnedAt: <ISO>}`, pretty-printed 2-space. Writes are tmp-file + rename (atomic); a failed read silently resets to `{}`. A learned selector is written when a ranked candidate validates, and deleted when the learned path stops resolving. |

## 4. Search screen & search flow

| # | Behavior | Where | Observable contract |
|---|---|---|---|
| B21 | Search screen | `src/tui/layouts/search/*`, `src/tui/components/input.tsx` | Input labelled `? Search:` (inverse-highlighted label while focused). Placeholder is the warning text. Container is capped at 80 columns / 95 % width (`SCREEN_*` settings) with the classic header. |
| B22 | Min-chars warning | `src/constants.ts:1`, `search/search-input/search-warning.tsx`, `src/tui/store/app.ts:101-106` | While the typed value is shorter than 3 chars, a yellow line renders `Search string must contain minimum 3 characters.` above the input; it disappears at ≥3. Submitting <3 from the search screen is a no-op (no toast). |
| B23 | Search submit (interactive) | `src/tui/store/events.ts:111-139` | Pushes the query into session history, switches to the browse layout, shows loader `Getting results`, runs the search. An unexpected exception (as opposed to a failure result) lands on the error screen with `Search failed unexpectedly. Please try again.` |
| B24 | Page fetch & failure mapping | `events.ts:34-80`, `src/api/search/search-service.ts`, `src/api/http/http-client.ts` | Page URL from the adapter (`/index.php?req=<q>&page=<n>&res=25`). Any transport error collapses to `Couldn't fetch the search page for "<query>"`. A mirror-rendered alert (`.alert-danger`) returns `connection_error` with the alert text. Resolution errors (including a reranker failure) are caught and become `Couldn't parse the search results for "<query>": <reason>` — parsing never rejects upward. |
| B25 | Page cache | `src/tui/store/cache.ts` | Successful pages cache by full search URL. A cached hit skips the network entirely (search, next/prev, next-page check all share it). Cache resets on mirror switch and on in-place search submit. |
| B26 | Connection-error recovery ladder | `src/tui/store/flows/search-flow.ts` | On failure: show `Connection error` (red) + failure message + the mirror-failover list inside the results panel. Probe every other search mirror (each with a `test` query, page 1); first success switches mirror, resets the cache, and retries. If no mirror answers, enter the availability wait loop (§8); each recovery steers to the recovered mirror and retries; loop until success or give-up. Give-up → error screen `All mirrors failed. Please try again later.` Interactive mode waits without a deadline; CLI mode (`-s`) caps the wait at 30 min (`CLI_MAX_LIBGEN_WAIT_MS`). |
| B27 | Mirror-failover list rendering | `src/tui/components/mirror-failover.tsx`, `src/tui/store/app.ts:7-12` | One row per candidate mirror: pending `·` gray, checking spinner cyan, ok `✓` green, failed `✗` red, under a yellow `Trying other mirrors...` heading. |
| B28 | In-place search from browse | `src/tui/layouts/browse/overlay-keys.ts`, `src/tui/store/browse.ts:123-136` | `/` focuses the search line pre-filled with the live query. Enter: draft ≥3 chars runs `submitSearchFromBrowse` (page → 1, cursor → 0, next-page state → idle, cache reset, selection/queue/progress untouched); draft <3 → warning toast `Search string must contain minimum 3 characters.` Esc restores the previous query and returns focus to the list. |
| B29 | Search history | `src/tui/store/browse.ts:6-7,77-115` | Session-only (never persisted), newest-first, deduped, capped at 10 entries. Every submit — including the first from the search screen — is recorded. ↑ walks older entries, ↓ walks back toward the newest and then returns to the live draft. |
| B30 | Search-history panel | `src/tui/layouts/browse/search-history.tsx`, `side-panel.tsx:80-105` | While the search input has focus the side panel becomes a `Search` panel (plain title, no tabs, no `v` hint): `Recent searches` header, pointer-marked rows (cursor = the entry matching the draft, else first row), hint `↑↓ pick · enter search · esc cancel`, note `Selections are kept across searches:`, yellow bullet line `• <n> in bulk queue`. Falls back to a compact variant (no blank separators) when short. |

## 5. Paging

| # | Behavior | Where | Observable contract |
|---|---|---|---|
| B31 | Page navigation keys | `src/tui/layouts/browse/list-keys.ts:47-55`, `src/tui/store/events.ts:140-192` | `←`/`h` previous page, `→`/`l` next page. Prev is a no-op on page 1. Both show loader `Getting results` while working. On success: cursor resets to 0; next keeps the new page and re-checks page+1; prev sets next-page status to `ready` (cache guarantees it exists). On failure: warning toast with the failure message, page unchanged. |
| B32 | Next-page state machine | `src/utilities.ts:73`, `events.ts:81-110`, `src/tui/layouts/browse/use-browse-keys.ts:110-129` | States `idle → checking → ready \| unavailable \| error`, computed asynchronously after every successful page load (checking page+1). **The state is never rendered** — `NEXT_PAGE_CHECKING/ERROR/UNAVAILABLE` labels exist but no component displays them. The only observable difference is what `→` does: ready/idle advance; error re-runs the check; checking is swallowed; unavailable raises the warning toast `No more results`. |
| B33 | Global result numbering | `src/tui/layouts/browse/results-panel.tsx:154` | Row numbers continue across pages: `(page-1) × 25 + index + 1`. |

## 6. Browse layout & chrome

| # | Behavior | Where | Observable contract |
|---|---|---|---|
| B34 | Minimum terminal size | `src/tui/layouts/browse/index.tsx:20-48` | Below 40×12 the browse screen renders only the yellow line `Terminal too small (min 40×12) — current <w>×<h>`; `q` still works through the key router. |
| B35 | Layout breakpoints | `src/tui/layouts/browse/layout-metrics.ts:32-42` | ≥100 columns: wide (results and side panel side by side, results takes `max(floor(cols×0.55), 56)`); 60–99: stacked (side panel below the list, fixed 7-row Detail box / 12-row Queue box); <60: compact (stacked, author column hidden). One left padding column is taken out of the side panel's share. |
| B36 | Vertical budget | `layout-metrics.ts:50-59,116-143` | Reserved rows: 1 header + 1 search line + 1 footer + 1 spare, +1 when a warning toast is visible, +5 when the availability banner is visible, +1 when the update notice is visible. List keeps ≥3 rows. |
| B37 | Screen furniture order | `browse/index.tsx:163-177`, `src/tui/app.tsx:44-55` | Column: status header (with optional update-notice row), main area, `[!] <warning>` line when a toast is up, availability banner when libgen is down, key footer. Everything except overlays can dim behind an open overlay. Layout switches clear the screen in interactive mode (`clearScreen`, with a broken Windows variant `"u001b[H\u001Bc"` — quirk). |
| B38 | Footer hint sets | `src/labels.ts:49-95`, `src/tui/components/key-footer.tsx` | Per focus: list-wide (`↑↓ move · space bulk · d download · ←→ page · / search · b start bulk · v queue · ? help · q quit`), list-narrow (drops `v`, shortens `d dl`, `b bulk dl`), queue (`v detail · ↑↓ move · x remove · r retry failed · space bulk · / search · ? help · q quit`), help (`esc close help`), quit (`y quit · n / esc stay`), full-detail (`esc back · ↑↓ prev/next · space bulk · d download`), search (`enter search · esc cancel · ↑↓ history · ctrl+u clear`). Keys bold cyan, descriptions gray, two spaces between pairs; hints that no longer fit are dropped and the row ends with ` …`. `x` renders dim gray while a bulk run is active. |

## 7. Status header

| # | Behavior | Where | Observable contract |
|---|---|---|---|
| B39 | Left side | `src/tui/layouts/browse/status-header.tsx:83-89,140-147` | `libgen-downloader <version>  │  ● <mirror host>` — version green, bullet green, separator and host gray. |
| B40 | Live summary (no bulk run) | `status-header.tsx:22-29,57-80,163-174` | Right-aligned segments over `downloadProgressMap`: `↓ N downloading`, `⋯ N queued` (bucket = IN_QUEUE + CONNECTING_TO_LIBGEN + PROCESSING + FETCHING_MD5 + WAITING_FOR_LIBGEN), `● N in bulk` (selection size), `✓ N done`, `✗ N failed`. Zero segments omitted; joined with ` · `. Wide (≥100) renders `↓ 2 downloading` (symbol space count word), compact renders `↓2`. Collision keeps one space and truncates. |
| B41 | Bulk-run header variant | `status-header.tsx:99-117,148-162` | While a run is active (`queue.length > 0 && !isBulkDownloadComplete`) the summary is replaced by `bulk <bar 16> <done>/<total>` plus ` · ✗ N failed` when failures exist. Download speed is intentionally not tracked. |

## 8. Results panel

| # | Behavior | Where | Observable contract |
|---|---|---|---|
| B42 | Panel frame | `src/tui/layouts/browse/results-panel.tsx:86-101`, `panel-border.ts` | Hand-drawn top border `╭─ Results <tail>` with the position marker `<cursor+1>/<count>` inside the line (only when loaded and non-empty), then a rounded borderless-top box. |
| B43 | Column header + widths | `src/tui/layouts/browse/result-row.tsx:10-65` | Dim header row: `#` (right, 3), `ext` (left, 5), `title` (flex), `author` (left, 16; drops to 14 when the title column would fall under 10; hidden in compact), `size` (right, 6), `st` (left, 4). Single-space separators; truncation to `…` then pad. |
| B44 | Result row rendering | `result-row.tsx:81-140` | Cursor row: background `#1f3140`, pointer cell `▸`, title white+bold. Ext green+bold. Number/author/size gray. Rows are memoised on entry id + number + cursor + status(symbol,color,kind) + dimmed + widths. |
| B45 | Row scroll window | `results-panel.tsx:29-49` | Window keeps the cursor ≥2 rows from the edges when possible, clamped so the window always fills the viewport. |
| B46 | Loading / empty states | `results-panel.tsx:102-131` | Loading: centered `simpleDotsScrolling` spinner + `Getting results`, or the connection-error block (§4 B26). Empty: centered `No results for "<query>"`. Search focus dims the panel to all-gray with a blank status column. |

## 9. Detail surfaces

| # | Behavior | Where | Observable contract |
|---|---|---|---|
| B47 | Side panel frame & tabs | `src/tui/layouts/browse/side-panel.tsx:59-136` | Top border tabs `Detail │ Queue N` — active tab bold, inactive gray, right-aligned dim `v` hint inside the border. `N` is the unfinished-item count (B69); bare `Queue` at 0. |
| B48 | Detail panel (wide) | `entry-detail.tsx:184-201`, `detail-fields.ts` | Bold title, gray authors, blank row, aligned key/value rows for Publisher / Year / Pages / Language / Format / Size (values via `formatField`, blank → `—`), MD5 row `first8…last4` (or `—`), blank, download rows, bulk line, pinned hint footer `space bulk · d download · enter full screen`. Note: the raw mirror URL is never rendered; MD5 comes from `adapter.getEntryMD5` (md5 query param or 32-hex match). With the libgen-plus adapter all six field rows render (`isHiddenField` hides nothing in practice; `id` is never in the list). |
| B49 | Detail download rows | `entry-detail.tsx:83-141`, `src/tui/helpers/display.ts` | While DOWNLOADING: `↓ <bar> NN%` (integer percent, bar width = width−8) plus gray `  <downloaded> / <total>` (filesize, base 2, jedec — e.g. `1.5 MB`). Every other direct status: `<glyph> <word>` colored per the shared map — words: Queued / Connecting / Processing / Fetching / Waiting for libgen / Failed / Downloaded. No record → nothing. |
| B50 | Detail panel (stacked) | `entry-detail.tsx:158-174` | Five lines: ① bold title + gray authors, ② gray `publisher · year · N pp · language · ext · size` (missing parts → `—`), ③–④ download block (two lines while downloading; otherwise one status line + one blank), ⑤ bulk line. |
| B51 | Bulk membership line | `entry-detail.tsx:143-156` | Member: yellow `● In bulk queue  space to remove`. Non-member: gray `○ Not in bulk queue  space to add`. |
| B52 | Full-screen detail | `full-detail-panel.tsx`, `list-keys.ts:115-146`, `browse/index.tsx:142-144` | Enter from the list replaces the main area with one bordered panel titled `Detail  N/<count>`; long values wrap instead of truncating. Keys: `esc`/`enter` back, `↑↓`/`k j` move the underlying cursor (prev/next entry), `space`/`tab` toggle bulk, `d` downloads. Footer set per B38. While a search/page change runs, its keys go inert except `q`/`?` (B57). |

## 10. Key router & focus model

| # | Behavior | Where | Observable contract |
|---|---|---|---|
| B53 | Single router, six focus modes | `src/tui/layouts/browse/use-browse-keys.ts` | One `useInput` dispatches on `browseFocus` ∈ {list, queue, search, help, quit, fullDetail}. Overlays (help/quit) remember the mode they opened from and return to it on close. |
| B54 | List-mode keys | `list-keys.ts:10-110` | `↑/k` −1, `↓/j` +1, `pgup/pgdn` ∓10, `g` first, `G` last (case-sensitive), `←→/h l` page, `space`/`tab` (legacy) toggle bulk on the cursor entry, `d` direct download, `enter` full detail, `/` search, `b` start bulk, `v` queue, `r` retry failed, `?` help, `q` quit. Cursor clamps to the entries; empty list keeps cursor 0 and item keys no-op. |
| B55 | Queue-mode keys | `queue-keys.ts:12-71,96-160` | `↑↓/k j` move the queue cursor over actionable rows (clamped), `x` remove-from-selection (only before/during-idle: ignored while a run is active, and only on a selected bulk row), `r` retry failed (only when the run is complete and failures > 0), `space`/`d` act on the cursor entry when it maps to a result, `esc` (only when no availability banner is showing) or `v` back to list with the Detail panel, `/` search, `?` help, `q` quit. |
| B56 | Search-mode keys | `overlay-keys.ts:9-73` | `esc` cancel (restore live query), `enter` submit (B28), `↑↓` history (B29), `ctrl+u` clear input (deferred via microtask so the text-input's own handler runs first). Every other key belongs to the text input — typing `q` or `d` inserts letters. |
| B57 | Loading gate | `use-browse-keys.ts:27-43,161-189` | While `isLoading` in list/queue/fullDetail, only `q` (quit prompt) and `?` (help) respond; ctrl+c keeps Ink's default exit. Overlay modes keep their own keys live (esc must close help/quit during an outage wait). The availability banner keeps `ctrl+r`/`esc` only in list/queue focus. |
| B58 | Help & quit overlays | `overlay-keys.ts:75-94`, `help-overlay.tsx`, `quit-overlay.tsx` | Help (`?`): centered 46-column `Keys` box — Navigate (`↑ ↓  k j move cursor`, `pgup pgdn jump 10`, `g G first / last`, `← →  h l prev / next page`), Act on item (`space add / remove from bulk`, `d download now`, `enter full-screen detail`, `tab same as space (legacy)`), Global (`/ search`, `b start bulk download`, `v toggle queue panel`, `r retry failed downloads`, `ctrl+r re-check libgen now`, `? this help`, `q quit`), close hint `esc or ? to close`. Truncates with `…`. Quit (`y` quits; `n`/`esc`/`enter` stays). |
| B59 | Quit prompt contents | `quit-overlay.tsx:14-96` | Shown by `q` only when work is pending: direct downloads queued/running (`1 download is still running or queued` / `N downloads are...`), bulk selection non-empty while the run hasn't finished (`1 item is in the bulk queue` / `N items are...`), or a running bulk run (`Bulk download is N/M done`). Always renders the two-line explanation `Quitting stops the download and` / `forgets the bulk selection.` and the action row with inverse `y` (red) `quit anyway` and inverse `n` (cyan) `stay`. Cosmetic blanks drop first when short. |

## 11. Bulk selection & bulk run

| # | Behavior | Where | Observable contract |
|---|---|---|---|
| B60 | Selection identity & toggling | `src/tui/store/bulk-download-queue.ts:74-110`, `use-browse-keys.ts:77-83` | Membership keyed by `objectHash(entry)` — content-addressed, so two parses of the same book dedupe. Toggle from list rows, full detail, or queue rows. Warning toasts `Entry with ID <id> is already in the bulk download queue` / `... is not in the bulk download queue` (note: message says ID, dedupe is by content hash). |
| B61 | Selection lifetime | `browse.ts:123-136`, `bulk-download-queue.ts:233-246` | Survives searches, page changes and `backToSearch`; consumed only by a bulk run: after a run, completed entries leave the selection, failed ones stay selected (`settleBulkRun`), and the queue stays rendered until the next `b` replaces it. |
| B62 | Start guard | `bulk-download-queue.ts:299-332` | `b` while a run is active → toast `Bulk download already running`. Empty selection → toast `Bulk download queue is empty`. Starting resets counters and both md5-list file names and clears failure reasons. |
| B63 | Run start in interactive mode | `bulk-download-queue.ts:324-331` | The side panel switches to the Queue tab and focus moves to it with the cursor at 0 — the browse screen stays (no layout change). |
| B64 | Queue build | `bulk-download-queue.ts:334-356` | One queue item per selected entry, ordered by selection iteration order, status `IN_QUEUE`, via `adapter.getEntryMD5`. Entries without an MD5 are skipped with the toast `Couldn't find MD5 for entry <id>`. |
| B65 | Run execution | `bulk-download-queue.ts:173-196`, `flows/bulk-download-flow.ts` | Items download strictly sequentially. Per item: `PROCESSING` → (waiting states, B79) → `DOWNLOADING` with filename+total → `DOWNLOADED`/`FAILED`. After the first pass, failed items are reset (`IN_QUEUE`, progress zeroed, reasons cleared) and re-run once (`BULK_RETRY_PASSES = 1`); then `isBulkDownloadComplete = true`, reports written (B76), settle applied (B61). |
| B66 | Failure recording | `flows/bulk-download-flow.ts:41-52`, `bulk-download-queue.ts:157-171` | A failed item stores its `summarizeFailures` text per md5 (`bulkFailureReasons`) and raises the toast `Couldn't download <md5>: <reason>`. An exception with no outcome fails the item without a reason. Retry resets wipe the stored reasons. |
| B67 | Manual retry | `bulk-download-queue.ts:198-206`, `queue-keys.ts:137-144` | `r` (list or queue mode) retries a finished run's failures only when `isBulkDownloadComplete && failedBulkDownloadItemCount > 0`, else no-op. It resets the failed items and re-enters the full operate loop (which also re-writes the md5-list files, reusing the file names). |
| B68 | CLI bulk screen | `src/tui/layouts/bulk-download/index.tsx` | CLI-mode bulk (and only CLI) renders: `COMPLETED (n) FAILED (m) TOTAL (t)`, `MD5 list file created: <name>` or a spinner while pending, `Failed MD5 list file created: <name>` (only when failures exist), `Downloading files to <cwd>`, then one line per queue item: legacy inverse status block + `NN.NN% <downloaded> / <total>` (percent with **two decimals** unless DOWNLOADED) + filename when known else `md5: <md5>`. `BulkDownloadAfterCompleteOptions` (↻ Retry Failed Downloads / Turn Back / Search list) renders only when `!CLIMode` on this layout — unreachable in the current wiring (interactive bulk never switches to this layout); treat as legacy. |
| B69 | `returnToListKeepingFailedSelected` | `bulk-download-queue.ts:278-297` | Post-run escape hatch that resets bulk state keeping only failed-MD5 selections and returns to the browse layout (used by the legacy after-complete options). |

## 12. Direct downloads

| # | Behavior | Where | Observable contract |
|---|---|---|---|
| B70 | Queueing | `src/tui/store/download-queue.ts:54-81` | `d`/`space`-download push an entry; dedupe by entry id while queued or running; a settled entry may be downloaded again. New record: status `IN_QUEUE`, progress 0. A push while the queue is idle starts the pump. |
| B71 | Serial pump | `download-queue.ts:106-194` | FIFO, one download at a time. Per entry: `CONNECTING_TO_LIBGEN`; missing MD5 → toast `Couldn't find the MD5 of "<title>"` + `FAILED` + continue; success → `DOWNLOADED`, `totalDownloaded++`; failure → toast `Couldn't download "<title>": <reason>` (or plain `Couldn't download "<title>"` on throw), `FAILED`, `totalFailed++`; finally the id leaves the in-queue set (the FAILED record itself persists in the progress map). |
| B72 | Progress accounting | `download-queue.ts:196-221` | `onStart` resets progress to 0 and records filename+total; each chunk adds its byte length. Progress persists for the session keyed by entry id — statuses stay attached across page navigation, but **detach** when the mirror switches (cache reset regenerates nanoid ids). The legacy screens render `totalAddedToDownloadQueue` as `DOWNLOADED n/total FAIL (x) to <cwd>` (green/red, cwd blue). |

## 13. Queue panel

| # | Behavior | Where | Observable contract |
|---|---|---|---|
| B73 | Section order | `src/tui/layouts/browse/queue-rows.ts:29-154` | `Bulk download` → blank → `Direct downloads` → blank → `Saved to <cwd>` → `Lists: <name>` rows (md5 list, then failed list, each only after it exists). Blank separators never lead. |
| B74 | Bulk section | `queue-rows.ts:58-111`, `queue-panel.tsx:77-149` | With a queue: header `Bulk download  <done> of <total> done` + red ` · N failed` when failures exist; overall bar (`█`/`░` cyan/gray + ` NN%` cyan, bar width = width−2−5); one row per queue item — shared status glyph + color, truncated title (falls back to the md5 when the entry isn't on the current page), gray size tail; a DOWNLOADING item carries its own indented bar line; a FAILED item with a stored reason carries a red indented reason line. Before a run: selected entries listed with `●` yellow. |
| B75 | Direct section | `queue-rows.ts:113-140` | Every progress-map record, newest first; title/size from the current page's entry when the id matches, else the raw entry id as the title. `space`/`d` act only when the row maps to a real entry. |
| B76 | Scroll & cursor | `queue-scroll.ts`, `queue-panel.tsx:62-71` | Scroll unit = an item row plus its attached bar/reason lines (groups render all-or-nothing; fixed rows never separated). The window keeps the cursor's group visible, fills forward then back. Cursor row gets the `#1f3140` background and bold title. Pinned hint row at the bottom: `x remove · r retry failed · esc back`, `x` dimmed during a run. |

## 14. Queue count (issue #5 semantics)

| # | Behavior | Where | Observable contract |
|---|---|---|---|
| B77 | `Queue N` | `src/tui/layouts/browse/queue-count.ts`, `side-panel.tsx:44-54`, `test/queue-count.test.ts` | Unfinished-item count, computed from the store (never from rendered rows). Bulk term = selected entries whose MD5 has **no terminal run outcome** (`DOWNLOADED` or `FAILED`) in `bulkDownloadQueue` — an outcome join by MD5, so a selection stops counting the moment its outcome lands, regardless of settle timing; selections that can't be joined (no adapter/md5) keep counting. Direct term = progress-map records not `DOWNLOADED`/`FAILED`. Terms sum independently: an item both bulk-selected and direct-downloading counts twice (accepted edge). `N = 0` renders the bare tab `Queue`; the tab is always visible. Failed = results, not pending work: a settled run with failures renders `Queue 0`; `r` re-inflates the count by resetting items to `IN_QUEUE`. |

## 15. Statuses & rendered strings

| # | Behavior | Where | Observable contract |
|---|---|---|---|
| B78 | Status enum | `src/download-statuses.tsx:3-13` | `IDLE, IN_QUEUE, PROCESSING, DOWNLOADING, DOWNLOADED, FAILED, CONNECTING_TO_LIBGEN, FETCHING_MD5, WAITING_FOR_LIBGEN`. Terminal = `DOWNLOADED`/`FAILED` only (glossary). |
| B79 | Legacy status blocks | `download-statuses.tsx:15-65`, `download-status-and-progress.tsx` | Inverse-colored text blocks with padded spaces: ` IN QUEUE ` grey, ` PROCESSING ` yellowBright, ` DOWNLOADING ` blueBright, ` DOWNLOADED ` green, ` FAILED ` red, ` CONNECTING TO LIBGEN ` yellowBright, ` FETCHING MD5 ` whiteBright, ` WAITING FOR LIBGEN ` magentaBright. Used by the CLI bulk screen. |
| B80 | Shared glyph map | `src/tui/layouts/browse/status-symbol.ts` | `⠋` cyan (static spinner — also PROCESSING/CONNECTING/FETCHING), `⋯` gray (IN_QUEUE), `↓` cyan (DOWNLOADING), `✓` green (DOWNLOADED), `✗` red (FAILED), `…` magenta (WAITING_FOR_LIBGEN); bulk selection `●` yellow sits beside the map (not a status). Result rows replace DOWNLOADING's glyph with the live integer percent. |
| B81 | Row-status priority | `row-status.ts:62-117`, `test/row-status.test.ts` | Direct progress beats bulk membership ("bulk-selected and downloading" shows the download). DOWNLOADING → `NN%` (integer, rounded, clamped 0–100) cyan. Spinner statuses → `⠋`. Waiting → `…`. Queued → `⋯`. Failed → `✗`. Downloaded → `✓`. Bulk-selected: `✓` when the item's md5 already has a `DOWNLOADED` run outcome (failed stays `●` — it remains selected for retry), else `●`. Otherwise blank. |
| B82 | Two percent formats | `row-status.ts:48-60` vs `helpers/display.ts:15-37` | Browse surfaces render integer percents; the legacy bulk screen renders `toFixed(2)` percents. Both clamp implicitly via division. A rewrite must pick per-surface or unify deliberately. |

## 16. Downloaded files & naming

| # | Behavior | Where | Observable contract |
|---|---|---|---|
| B83 | Save location & name | `src/api/data/download.ts:14-66` | Files land in `process.cwd()` as `./<filename>`; filename comes from the `Content-Disposition` header (parsed with `content-disposition`), truncated to the **last 128 characters**. Missing header → `FileDownloadError("No content-disposition header found")`; missing body → `FileDownloadError("No response body")`; stream failure → `(<filename>) Error occurred while downloading file`. Total = `content-length` or 0 (indeterminate progress). |
| B84 | md5-list output files | `src/api/data/file.ts`, `bulk-download-queue.ts:248-276` | After each bulk run (and each retry pass): completed md5s → `libgen_downloader_md5_list_<Date.now()>.txt`; failures → `libgen_downloader_failed_md5_list_<ts>.txt`; contents = md5s joined by `\n`, **no trailing newline**. The same file name is reused across passes within a run (only the first run after a start generates new names). The failed file is written only when there are failures or a previous failed file name exists. Write failures → toasts `Couldn't create the MD5 list file` / `Couldn't create the failed MD5 list file`. |

## 17. md5-list usage (round trip)

| # | Behavior | Where | Observable contract |
|---|---|---|---|
| B85 | Input | `src/cli/operate.ts:50-63` | `-b` consumes a list file: one md5 per line, blank lines skipped, `\r` not stripped (quirk, B3). |
| B86 | Output → input loop | B84 + B85 | The failed-md5 file is formatted exactly so it can be fed back via `-b`; the completed file records what succeeded. This round trip is the files' purpose and must survive the rewrite. |

## 18. Retry & recovery

| # | Behavior | Where | Observable contract |
|---|---|---|---|
| B87 | Source ordering & cooldown | `src/api/download/download-service.ts`, `src/api/availability/mirror-health-registry.ts` | Sources are tried in health order: `trial` before `healthy`; sources cooling down are skipped and reported as failures with reason `cooling down after: <last reason>`. A source records a failure per non-`not-available` error (consecutive count + retryAt = now + backoff(failures−1)); success resets it. Cooldown uses the same 15 s→300 s policy as recovery. |
| B88 | Per-source attempts | `download-service.ts:24-44`, `src/settings.ts:21-22` | Each source gets 2 attempts with a 30 s timeout; retry continues for every failure except `DownloadUnavailableError` ("not available on this mirror"). |
| B89 | Recovery loop per book | `src/api/download/recovering-download-service.ts` | When every source fails waitably (any failure kind ≠ `not-available`), and waiting is allowed, the service waits for libgen to recover and retries, up to `MAX_BOOK_WAIT_MS` = 90 s per book (deadline from loop start). `not-available` outcomes never wait. Hooks: `onWaiting(outage)`, `onResumed(sources)` fire per cycle. |
| B90 | Outage classification | `src/api/availability/utils/failures.ts` | Kinds: `backend-overloaded` (page text matches could-not-connect/max_user_connections/too many connections/database error/database is unavailable), `rate-limited` (429), `server-error` (≥500), `unreachable` (AbortError/TimeoutError/TypeError/any error with a `code`), `not-available` (everything else). Display strings: `libgen's database is overloaded`, `libgen servers are returning errors`, `libgen is rate limiting requests`, `libgen mirrors are unreachable`, `the book is not available on the mirrors`. The outage shown for a set of failures picks by priority backend-overloaded → rate-limited → server-error → unreachable, else `unreachable`/`no mirror responded`. |
| B91 | Availability monitor | `src/api/availability/availability-monitor.ts`, `shared-recovery-wait.ts` | One shared wait across concurrent waiters (search + downloads join the same cycle). Each cycle: publish `waiting` (with since/checks/nextCheckAt/optional deadline), sleep under backoff (15 s, 30 s, … 300 s cap, ±20 % jitter), publish `checking`, probe health checks in order — first healthy source wins (`markRecovered` → `trial` state). Checks per mirror: download target = open the md5 and cancel the body; search target = fetch page 1 of the query (spa mirrors contribute no search check). Check timeout 20 s. `checkNow()` (ctrl+r) wakes the sleep early. Ending publishes `available`. |
| B92 | Decline / manual controls | `src/tui/store/availability.ts`, `availability-banner.tsx`, `overlay-keys.ts` | `esc` (list/queue focus only) stops waiting: aborts the current wait and sets `libgenWaitDeclined`, so downloads' `shouldWait` returns false and pending recoveries give up instead of waiting. Any new search / bulk start / direct download calls `allowWaitingForLibgen()` and re-enables waiting. `ctrl+r` forces an immediate check. On recovery the store raises the toast `libgen is reachable again via <hosts>, resuming`. |
| B93 | Availability banner | `src/tui/components/availability-banner.tsx` | Magenta rounded box: `⚠ <failure description> (<reason>)`; then either `Checking libgen mirrors...` or `Waiting for libgen, next check in <dur>` + gray ` • checks <n> • waiting <elapsed>` + ` • gives up in <remaining>` when a deadline applies; last line `[ctrl+r] check now  [esc] stop waiting`. Durations format as `Xs` or `Xm Ys` (ceiling seconds); a 1 s tick keeps it live. The banner reserves 5 rows in the layout budget (B36) and owns `esc` over the queue panel (B55). |

## 19. Reranker assets

| # | Behavior | Where | Observable contract |
|---|---|---|---|
| B94 | Embedded assets | `src/api/resolution/model/embedded-reranker-files.ts`, `src/types/assets.d.ts` | `assets/models/reranker/{model.onnx, tokenizer.asset, tokenizer-config.asset}` and the ort wasm binary are **build-time embedded** (Bun `with { type: "file" }` imports, read via `readFile` at runtime). |
| B95 | Pinned fetcher | `scripts/models/{manifest,types,pinned-model-fetcher}.ts`, `package.json` scripts | `bun run models:fetch` (runs before `start`, every `build`/`compile` target) ensures the three files: cached copies are re-verified against pinned sha256 (`f24d6dcf…` model, `d241a60d…` tokenizer, `0b29c7bf…` tokenizer-config); a mismatch or absence downloads from `https://huggingface.co/Xenova/ms-marco-TinyBERT-L-2-v2/resolve/b76bb5e1fefd66aa36cd108622d768e86c015ff1/<source>` (model_int8.onnx, tokenizer.json, tokenizer_config.json), verifies the checksum (`Checksum mismatch for <file>: expected <sha>, got <sha>` on mismatch, `Download failed (<status>): <url>` on HTTP error), and writes via tmp + atomic rename. **This is fetch-on-missing at build time only — there is no runtime network fetch of model assets anywhere in `src/`.** |
| B96 | Reranker runtime | `cross-encoder-model.ts`, `cross-encoder-settings.ts`, `resolver-factory.ts`, `rankers/cross-encoder-ranker.ts` | ONNX wasm single-threaded (`numThreads = 1`), max sequence 256, query = the resolution intent string, documents = candidate descriptions, scores sorted descending, top 3 proposed. Loaded lazily on first use; released after each resolution. |
| B97 | Degradation contract | `src/api/resolution/selector-resolver.ts:33-51`, `src/tui/store/events.ts:57-76`, `test/search-empty-page.test.ts` | A throwing stage (model load failure included) contributes no proposals and later stages still run; resolution never rejects. If everything fails, `resolveEntries` returns `[]` (empty success) or the error result path (`Couldn't parse the search results for "<query>": <reason>`). Stages: `known` (hand selectors `#tablelibgen` / `#main > tr:first-child > td:nth-child(2) > a`) → `learned` (selectors.json) → `ranked` (heuristic) → `ranked` (cross-encoder, speculative). Learned selectors are deleted when they stop resolving; validated ranked candidates are persisted. |

## 20. Errors, warnings & loader strings

| # | Behavior | Where | Observable contract |
|---|---|---|---|
| B98 | Error screen | `src/tui/components/error-message.tsx`, `src/tui/store/config.ts:66-86` | Full-screen replacement: `Something went wrong: <message>` + option list (`↻ Retry` — only when the search value is ≥3 chars — and `✖ Exit`, ↑↓/k j wrapping selection, enter activates, pointer `▸` yellow). Messages that land here: `Couldn't fetch the config`, `Couldn't find a working mirror`, `All mirrors failed. Please try again later.`, `Search failed unexpectedly. Please try again.` |
| B99 | Warning toasts | `src/tui/store/app.ts:110-123`, rendered in `browse/index.tsx:167-171` / `app.tsx:63` | Yellow `[!] <message>` line, auto-clears after 5 s (each new toast resets the timer). Full inventory of toast strings: `Entry with ID <id> is already in the bulk download queue` / `... is not in the bulk download queue`, `Couldn't find the MD5 of "<title>"`, `Couldn't download "<title>"[: <reason>]`, `Couldn't download <md5>: <reason>`, `Couldn't find MD5 for entry <id>`, `Bulk download queue is empty`, `Bulk download already running`, `No more results`, `Search string must contain minimum 3 characters.`, page-change failure messages (B31), `Couldn't create the [failed ]MD5 list file`, `libgen is reachable again via <hosts>, resuming`. |
| B100 | Loader messages | `src/labels.ts:16-19,29` | `Fetching configuration file...`, `Finding an available mirror...`, `Couldn't reach to mirror, <src>. Finding an available mirror...`, `Getting results` — spinner + message (search screen) or spinner + message (results panel). |
| B101 | Wrapped error strings | `src/errors.ts`, `src/api/download/utils/failure-text.ts` | Raw error texts that can surface inside composed messages: `HTTP <status> for <url>`, `Error occurred while fetching document of <url>`, `Error occurred while fetching configuration.`, `Unknown mirror type: <type>`, `Unsupported model input: <name>`, `(<filename>) Error occurred while downloading file`. Failure summaries: `tried <n> sources (<src>: <reason>; …; X more)` listing at most 3, reasons capped at 120 chars (alert text from `.alert-danger`/`.alert`, else `h1`/`title`); `no download sources are configured` when empty. `attempt`'s `onFail`/`onError` strings (`Request failed, trying again i/n`) exist but no current caller passes them. |

## 21. Non-browse screens (search + CLI bulk chrome)

| # | Behavior | Where | Observable contract |
|---|---|---|---|
| B102 | Classic header | `src/tui/components/app-header.tsx:36-65` | `• libgen-downloader @<version> → github.com/obsfx/libgen-downloader` plus `Active mirror → <baseURL>` when a mirror is set, plus the update-notice row (B15). |
| B103 | Container width | `src/tui/components/app-container.tsx`, `src/settings.ts:5-7` | Non-browse layouts render inside 95 % width, capped at exactly 80 columns when `cols − 5 > 80`, `marginLeft 1`, `paddingRight 4`. The browse screen bypasses this cap (full terminal width). |
| B104 | Download indicator | `src/tui/components/download-indicator.tsx` | On non-browse layouts, once anything was queued: `DOWNLOADED <done>/<added> FAIL (<n>) to <cwd>` (green/red/cwd-blue). Hidden at 0 added. |

## 22. GLOSSARY cross-check

All glossary terms (`GLOSSARY.md`, 10 terms) were checked against the code. **No term is contradicted by the code**; three soft findings:

1. **"Bulk run: One execution of a bulk download over the bulk selection"** — under-specifies CLI mode: `-b`/`-d` runs execute over an md5 list with no selection and no settle step (`startBulkDownloadInCLI`, `bulk-download-queue.ts:359-375`). The definition silently assumes interactive runs. Suggested glossary tweak, not a code contradiction.
2. **`constants.ts` dead constants** — `MIN_RESULT_LIST_LENGTH`, `RESULT_LIST_LENGTH`, `RESULT_LIST_ACTIVE_LIST_INDEX` (and `src/tui/hooks/use-scrollable-list-controls.tsx`, plus the `SEARCH`/`NEXT_PAGE`/`PREV_PAGE`/`NEXT_PAGE_*` labels and `Option.SEARCH/NEXT_PAGE/PREV_PAGE` enum values) are leftovers of the pre-redesign list layout. Nothing renders or reads them. The rewrite must **not** treat them as behavior.
3. **Help-text drift** — the CLI help example shows `MD5_LIST_1695686580524.txt`, but generated files are named `libgen_downloader_md5_list_<unix-ms>.txt` (B84). Cosmetic drift in `src/cli/index.ts`, worth fixing in the rewrite's help text deliberately (keep or correct — either is a decision).

Verified-consistent (spot checks): *Queue count* = `unfinishedQueueCount` exactly; *terminal status* = the `isCompleted`/`isFailed`/`unfinishedQueueCount` logic; *bulk selection* persistence = `submitSearchFromBrowse` never touches selection and `settleBulkRun` only drops completed md5s; *browse screen* composition = header + search line + results + side panel + footer.

## 23. Riskiest parity items

1. **Queue count + settle semantics (B61, B77)** — the issue-#5 rules (outcome join by MD5, failed-counts-as-zero, double-count edge, bare `Queue` at 0) are subtle, spec-pinned, and test-backed; a naive "phase-based" port will drift.
2. **Recovery ladder timing (B87–B93)** — five interacting timers/policies: source cooldown ordering, per-source 2×30 s, shared monitor backoff 15 s→300 s ±20 % jitter, 90 s per-book deadline, 30-min CLI search deadline, plus decline semantics (`esc`) and re-arm points. Easy to get individually right and compositionally wrong.
3. **Exact rendered strings and the two percent formats (B79–B82, B99–B101)** — dozens of literal strings, glyphs (`⠋ ⋯ ↓ ✓ ✗ … ●`), colors, singular/plural quit lines, and the int-vs-`toFixed(2)` percent split.
4. **Identity & cache churn (B25, B70-B72)** — nanoid per parse, statuses attached by entry id, cache reset on mirror switch detaching statuses, bulk selection keyed by content hash (dedupe across parses). Any change in id stability changes what the user sees after a mirror switch.
5. **File conventions (B83–B86)** — content-disposition-derived names with the 128-char slice, cwd placement, md5-list file naming/reuse rules, no trailing newline, and the CRLF input quirk.
6. **Reranker degradation (B94–B97)** — assets embedded at build time (pinned sha256, no runtime fetch); a model failure must degrade to heuristic resolution, never crash or fail the search.
7. **Invisible state machine (B32)** — the next-page status changes only `→`'s behavior; a rewrite that renders it (or drops a state) changes observable behavior with no visual diff to copy from.

## 24. Cross-references

- Queue-count semantics resolution: id1x/libgen-downloader#5 (resolution comment) — mirrored in B77 and the glossary.
- Spec: `docs/libgen-downloader master detail TUI redesign — implementation spec.md` (the §-numbers in code comments refer to it).
- Sibling research tickets: #14 (rerank pipeline → ort), #17 (crate selection), #19 (byte-identical surfaces — B84/B85 and the CLI flags are the likeliest members of that set), #20 (this file).
