# Upstream contribution facts: obsfx/libgen-downloader

Research for [issue #3](https://github.com/id1x/libgen-downloader/issues/3). Investigated 2026-11-11 against primary sources only: upstream repo contents, GitHub REST API (trees, pulls, contents), CI workflow source. Upstream default branch: `master`.

## 1. Does upstream document contribution rules?

**No formal documentation.** Repo root has no `CONTRIBUTING.md`, no `CODE_OF_CONDUCT.md`, no `SECURITY.md`; `.github/` contains only `workflows/` — no issue templates, no PR template, no `FUNDING.yml`. No DCO sign-off and no CLA anywhere in the repo. The README (headings: Important Update / Installation / Features / Changelogs) has no contributing section.

**De facto contract is CI.** [`.github/workflows/pull-request.yml`](https://github.com/obsfx/libgen-downloader/blob/master/.github/workflows/pull-request.yml) runs on every PR targeting `master` and gates on (Bun 1.3.9, `bun install --frozen-lockfile`):

- `bun run typecheck`
- `bun run test`
- `bun run lint` (ESLint, `eslint.config.js`)
- `bun run format:check` (Prettier, `.prettierrc`)
- `bun run build` + Node.js smoke test (`node build/index.js --help`)

Toolchain fact for the spec: `bun.lock` is committed — upstream uses Bun as the package manager.

Recent history (via git log of the identical commit) shows the house style: PRs are merged merge-commits from `obsfx`'s own branches (`Merge pull request #100 from obsfx/feat/availability-self-healing-downloads`), subjects use conventional-commit prefixes (`fix:`, `feat/...`), and releases are version-bump commits (`3.4.0`) via `.github/workflows/version-bump.yml`.

**Practical read:** outside PRs are accepted (license is fully permissive, CI defines the bar), but the burden is on the contributor to match typecheck/lint/format conventions exactly — no template will prompt for it.

## 2. Is upstream's `src/tui` structured the same as the fork's?

**Identical — zero divergence.** `id1x/libgen-downloader` master is at the exact same commit as upstream master: `f5b05984003d7ec440ac40e5606d0b3184c5226f` (verified via `gh api repos/{owner}/commits/master` on both). The recursive git trees of both repos at `master` are byte-identical at the path level (229 paths each; `diff` empty). Every `src/tui` path exists in both; no file is fork-only or upstream-only.

Upstream `src/tui` layout ([browse](https://github.com/obsfx/libgen-downloader/tree/master/src/tui)):

- `layouts/` — `index.tsx`, `layout.tsx`, `keys.ts`, plus `result-list/`, `search/` (with `search-input/`), `detail/`, `bulk-download/`, `bulk-download-before-exit/`, `download-queue-before-exit/`
- `components/` — 16 Ink components (`option-list.tsx`, `app-header.tsx`, `download-indicator.tsx`, `mirror-failover.tsx`, …)
- `contexts/` — `result-list-context.tsx`
- `helpers/` — `display.ts`
- `hooks/` — `use-list-controls.tsx`, `use-now.tsx`, `use-scrollable-list-controls.tsx`, `use-stdout-dimensions.tsx`
- `store/` — `app.ts`, `availability.ts`, `bulk-download-queue.ts`, `cache.ts`, `config.ts`, `download-queue.ts`, `events.ts`, `index.ts`, `store-recovery-waiter.ts`, `flows/` (`search-flow.ts`, `bulk-download-flow.ts`), `utils/`

Note for spec wording: upstream has `contexts/` and `helpers/` directories in addition to the `layouts/components/store/hooks` quartet. Width handling enters the TUI via `hooks/use-stdout-dimensions.tsx`.

**Consequence:** the spec can be written directly against upstream `master` at `f5b0598`; no reconciliation layer between fork and upstream is needed.

## 3. What license does upstream use, and does the fork's match?

**WTFPL v2** ("Do What The F*ck You Want To Public License", Version 2, December 2004), Copyright (C) 2025 Ömercan Balandı <balandiomer@gmail.com> — [`LICENSE`](https://github.com/obsfx/libgen-downloader/blob/master/LICENSE). GitHub license metadata: `spdx_id: WTFPL`.

The fork's `LICENSE` is **byte-identical** to upstream's (verified with `diff`), i.e. it retains Ömercan Balandı's copyright line. WTFPL imposes no attribution/redistribution requirements anyway, so the spec needs no licensing caveats — just don't delete the notice.

## 4. Open upstream PRs touching TUI / navigation / width handling?

**Zero open PRs** (`gh api repos/obsfx/libgen-downloader/pulls?state=open` → `[]`). No competing or pending TUI, navigation, or width/layout work upstream; nothing to coordinate with, and no existing PR to use as a template.

## Pointers

- Upstream repo: https://github.com/obsfx/libgen-downloader
- CI workflow: https://github.com/obsfx/libgen-downloader/blob/master/.github/workflows/pull-request.yml
- Release workflow: https://github.com/obsfx/libgen-downloader/blob/master/.github/workflows/release.yml
- License: https://github.com/obsfx/libgen-downloader/blob/master/LICENSE
- This archive branch: https://github.com/id1x/libgen-downloader/tree/research/upstream-contributions
