# ratatui-browse-spike

PROTOTYPE — throwaway. Wayfinder ticket
[id1x/libgen-downloader#15](https://github.com/id1x/libgen-downloader/issues/15):
*Does the master/detail TUI spec translate cleanly to ratatui?*

Renders the BROWSE layout from
`docs/libgen-downloader master detail TUI redesign — implementation spec.md`
on mock data (no network, no real store): results panel, Detail/Queue side
panel, responsive breakpoints at 100/60 columns, 40×12 floor, the single key
router with the spec keymap, help + quit overlays, fake direct-download and
bulk-run progress that ticks forward.

## Run

```sh
cargo run -q                          # live TUI (q quits, ctrl+c exits)
cargo run -q -- --snapshot 120x36 80x30 59x20 40x12   # static captures
cargo run -q -- --snaprun 120x36      # bulk run mid-flight capture
```

## What to poke at

- `j/k ↑↓` cursor, `g/G` ends, `PgUp/PgDn`, `h/l ←→` pages
- `space` bulk-select, `d` direct download (watch it tick to `✓`)
- `v` toggle Detail ↔ Queue, `b` start bulk run (second item fails; `r` retries)
- `/` search focus (type, `esc` restores, `enter` submits, `↑↓` history)
- `enter` full-screen detail, `?` help, `q` quit prompt
- resize the terminal across 100 / 60 columns for the breakpoints

Mock state is seeded to the spec's section 5.1 scenario: cursor on item 2
(downloading 42%), 1 done, 3/5/7 bulk-selected, 4 queued, 9 failed.
