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
