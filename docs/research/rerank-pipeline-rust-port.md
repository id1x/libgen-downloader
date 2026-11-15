# Rerank pipeline → ort + tokenizers (Rust) mapping

Research for [id1x/libgen-downloader#14](https://github.com/id1x/libgen-downloader/issues/14).
Reads `src/api/resolution/` on `master` (f5b0598); the one newer fix on the working
branch (`77eb40e`, degrade-don't-reject) is called out where it matters.

## Verdict (TL;DR)

The pipeline ports cleanly. `ort` 2.0.0-rc.14/15 (ONNX Runtime 1.31 native) covers
everything `onnxruntime-web` 1.30 does today — same engine family, and the sha-pinned
int8 model loads via `Session::builder(&env)?.commit_from_memory(...)`. The one
*premise correction*: `@huggingface/tokenizers` 0.2.0 is **not** a binding of the Rust
`tokenizers` crate — it is Tokenizers.js, a **pure-JS reimplementation** of it
([npm](https://www.npmjs.com/package/@huggingface/tokenizers),
[tokenizers.js](https://github.com/huggingface/tokenizers.js): "A pure JS/TS
implementation"). So the Rust crate is the reference implementation and the JS package
is the approximation; parity must be *proven by golden tests*, not assumed, even though
the BERT WordPiece pipeline used here is the JS port's best-covered path. No port
decision forces a user-visible behavior change; the two watch-items are float/kernel
drift reordering a near-tie in the top-3 ranking (mitigable with rank-order golden
tests) and the larger shipped binary from embedding ONNX Runtime natively.

## 1. The TS pipeline, end to end

### Wiring

`AppServices` builds a `ResolverFactory(http, selectorStore, crossEncoder?)`
(`src/api/services/app-services.ts:45`), defaulting the cross-encoder to
`new CrossEncoderModel(new EmbeddedRerankerSource())`; `crossEncoder: false` disables it
entirely (`app-services.ts:65-72`). Two consumers build resolvers:

- **download-link** — `DownloadPageResolver.resolve` parses the download page with
  `linkedom` and resolves the file button
  (`src/api/download/download-page-resolver.ts:16-25`).
- **results-table** — `LibgenPlusAdapter.resolveEntries` resolves the search-results
  table (`src/api/adapters/libgen-plus-adapter.ts:35-46`).

The natural-language `intent` for each task is fixed prose (`src/api/resolution/intents.ts`):
"The link that downloads the book file itself: …" / "The table listing the book search
results, one row per book …". That string is the **query** half of every cross-encoder
pair.

### Stages (`ResolverFactory.createResolver`, resolver-factory.ts:46-63)

| # | Stage | Proposes | Notes |
|---|-------|----------|-------|
| 1 | `KnownSelectorStage` | CSS selectors shipped with the adapter | first match wins |
| 2 | `LearnedSelectorStage` | DOM path re-resolved from `FileSelectorStore` (`selectors.json` in the cache dir) | a hit that fails validation is deleted (`selector-resolver.ts:80-82`) |
| 3 | `RankedCandidateStage` + `*HeuristicRanker` | extractor + regex/structure scoring | `speculative = true` |
| 4 | `RankedCandidateStage` + `CrossEncoderRanker` | same extractor, model-ranked | only when a cross-encoder was provided; also `speculative = true` |

`SelectorResolver.resolve` walks stages in order, dedupes elements across stages,
validates each proposal, returns on the first valid one, and learns the DOM path into
the store when the winning stage was `ranked` (`selector-resolver.ts:28-104`).
`RANKED_TOP_K = 3` caps what each ranked stage may propose (`settings.ts:1`).

On `master`, a stage that throws propagates out of `resolve()`; commit `77eb40e` (on
`feat/master-detail-tui`) makes a throwing stage contribute zero proposals so a
cross-encoder load failure degrades to "unresolved" instead of crashing. The port must
carry the degraded semantics.

### Extractors and heuristics

- `AnchorCandidateExtractor` (`a[href]`, minus `#`/`javascript:`/`mailto:`) describes each
  anchor as ``<a href="…md5 shortened to first 6 chars…"> text="…≤60 chars…"``.
- `TableCandidateExtractor` (`table`) describes ``<table> rows=N cols=M header="a | b" sample="…≤100 chars…"``.
- Heuristics: `DownloadLinkHeuristicRanker` scores href/keywords (file endpoint +3, md5 +1,
  `key=` +1, "get"/"download" text +2); `ResultsTableHeuristicRanker` counts result-like
  rows (≥5 columns with an md5 anchor).
- Validators: `DownloadLinkValidator` actually fetches the candidate URL and requires
  `ok` + `content-disposition` (payload = the `Response`); `ResultsTableValidator` checks
  table shape (≥5 columns, ≥50% wide/linked rows, or header-only tables).

### The cross-encoder model

**Assets** (`scripts/models/manifest.ts`): pinned at repo
`Xenova/ms-marco-TinyBERT-L-2-v2`, revision `b76bb5e1…`, three files fetched from
Hugging Face by `scripts/models/pinned-model-fetcher.ts` (sha256-verified, atomic
rename, cached-when-checksum-matches) into `assets/models/reranker/`:
`model.onnx` (4.47 MB, from `onnx/model_int8.onnx`), `tokenizer.asset`
(`tokenizer.json`, 695 KB), `tokenizer-config.asset` (`tokenizer_config.json`, 1.2 KB).
The assets are **committed to git**; `models:fetch` runs before every build/compile and
re-downloads only on checksum mismatch.

**Model tensors** (`src/api/resolution/model/cross-encoder-model.ts`):

- Inputs (verified in the binary): `input_ids`, `attention_mask`, `token_type_ids`,
  each int64, shape `[1, len]` — built by `int64Tensor` as
  `BigInt64Array.from(values.slice(0, length), BigInt)` with
  `MAX_SEQUENCE_LENGTH = 256` (`cross-encoder-settings.ts`). Any session input outside
  the three-feature set throws `UnsupportedModelInputError`.
- Output: `logits` (shape `[1,1]`, num_labels=1); the score is `Number(logits.data[0])`.
- One inference **per candidate**, sequential, with `signal.throwIfAborted()` between
  documents.

**Tokenization** (`cross-encoder-model.ts:35-55`): `tokenizer.encode(query,
{text_pair: document, return_token_type_ids: true})`. Reading the exact Tokenizers.js
implementation the app imports
([Tokenizer.ts](https://raw.githubusercontent.com/huggingface/tokenizers.js/main/src/core/Tokenizer.ts)):
`add_special_tokens` defaults to `true`, so the `TemplateProcessing` pair template in
`tokenizer.json` produces `[CLS] A [SEP] B [SEP]` with type ids `0…0 1…1`;
`attention_mask` is all-1s (no padding is ever applied — `truncation`/`padding` are
`null` in tokenizer.json); unknown tokens map to `[UNK]` (id 100). The app then
hard-slices ids/mask/type-ids to 256 *after* encoding — i.e. a long pair loses its tail
tokens (possibly the final `[SEP]`) rather than being truncated cleanly by the
tokenizer. The Rust port must reproduce this slice-after-encode behavior byte for byte.

**Runtime loading** (`cross-encoder-model.ts:67-83`): on first `score()` (memoized
promise, reset on failure so a later call retries), the app loads in parallel: the
assets, the `ort-wasm-simd-threaded.wasm` binary (imported at build time with
`with { type: "file" }` and read from disk next to the bundle — "embedded" means
*sibling file for `bun build`, binary segment for `bun --compile`*), the
`onnxruntime-web/wasm` module (with `numThreads = 1`), and `@huggingface/tokenizers`.
Tokenizer = `new Tokenizer(JSON.parse(tokenizer), JSON.parse(tokenizerConfig))`;
session = `InferenceSession.create(model)`.

## 2. Mapping to Rust

| TS piece | Implementation | Rust equivalent | Risk |
|---|---|---|---|
| `CrossEncoderModel` | lazy `Promise<LoadedModel>`, memoized, reset-on-error | struct with `tokio::sync::OnceCell` (reset on error), or plain lazy init; `Drop` replaces `session.release()` | low |
| `InferenceSession.create(assets.model)` | wasm runtime | `ort::init().build()` once → `Session::builder(&env)?.with_optimization_level(Level3)?.with_intra_threads(n)?.commit_from_memory(&MODEL_ONNX)` ([SessionBuilder](https://docs.rs/ort/2.0.0-rc.14/ort/session/builder/struct.SessionBuilder.html)) | low — API confirmed |
| `runtime.env.wasm.numThreads = 1` | | `with_intra_threads(1)` for strict parity, or more for speed (results are deterministic either way) | none |
| `int64Tensor(runtime, values, length)` `[1,len]` int64 | | `Tensor::from_array(([1usize, len], Vec::<i64>))` (ids are `u32` from tokenizers → cast) | low |
| `model.session.run(feeds)` | first output `logits.data[0]` | `session.run(ort::inputs![...])?["logits"]` → `try_extract_tensor::<f32>()` first scalar. Note `run(&mut self)` — one session at a time, which matches the sequential per-candidate loop ([Session docs](https://docs.rs/ort/2.0.0-rc.14/ort/session/struct.Session.html)) | low |
| `signal.throwIfAborted()` between docs | | check a `CancellationToken` between runs; optionally `RunOptions` + `terminate()` per run for true mid-run cancellation ([run_with_options](https://docs.rs/ort/2.0.0-rc.14/ort/session/struct.Session.html#method.run_with_options)) | low |
| `new Tokenizer(tokenizerJson, tokenizerConfig)` | JS reimplementation | `tokenizers` crate: `Tokenizer::from_bytes(&TOKENIZER_JSON)`; **tokenizer_config.json becomes dead weight** (its special-token fields are already baked into tokenizer.json's post-processor; only `clean_up_tokenization_spaces` matters for decode, which the app never calls) | low, see parity §4 |
| `encode(query, {text_pair, return_token_type_ids: true})` | | `tokenizer.encode((query, doc), true)` — tuple → `EncodeInput::Dual`, `add_special_tokens = true`; `encoding.get_ids()/get_attention_mask()/get_type_ids()` ([source, v0.23.2](https://raw.githubusercontent.com/huggingface/tokenizers/v0.23.2/tokenizers/src/tokenizer/mod.rs)) | low |
| slice to `MAX_SEQUENCE_LENGTH = 256` after encode | | identical `truncate(256)` on all three arrays — do **not** use the crate's `set_truncation`, which would keep the final `[SEP]` and change token contents | medium — must match exactly |
| `EmbeddedRerankerSource` + `readEmbeddedAsset` | sibling files / bun-embedded | `include_bytes!` (or `rust-embed`) of the same committed `assets/models/reranker/*`; `commit_from_memory` + `Tokenizer::from_bytes` | low |
| `scripts/models/pinned-model-fetcher.ts` + manifest | build-time fetch + sha256 | assets stay git-tracked, so the fetcher is only a repo tool; port the sha256 check into a build script or `#[test]` over the embedded bytes | none |
| `FileSelectorStore` (atomic write via tmp+rename) | | same JSON file, `std::fs`/`tokio::fs` + `persist` on a `NamedTempFile`, or keep the pid-suffixed tmp + rename | low |
| extractors / heuristic rankers / validators / DOM path | linkedom + CSS | `scraper` (html5ever + CSS selectors) — port is mechanical; the download-link validator needs the HTTP client (reqwest) + `content-disposition` header check | medium — DOM library semantics differ (see §4) |
| `ResolverFactory` / `SelectorResolver` stage loop | trait objects | traits `Stage`/`Extractor`/`Ranker`/`Validator` + `Vec<Box<dyn Stage>>`; the learned-store delete and remember logic port verbatim | low |

Suggested crate pins (Nov 2026): `ort = "=2.0.0-rc.15"` (rc.15 fixes 30+ UB/memory-safety
issues; "highly recommended to upgrade"
[release notes](https://github.com/pykeio/ort/releases)) — note rc.14 made
`ort::init().build()` mandatory before building sessions and bumped MSRV to 1.92;
`tokenizers = "0.23"` (stable line; the 1.0.0 series is still at rc.4 with a reworked
API and no stable release yet [releases](https://github.com/huggingface/tokenizers/releases)).

## 3. Asset strategy

- The three assets (≈5.2 MB total) are **already committed**; a Rust build needs no
  network. Embed with `include_bytes!` for the single-binary story (matching
  `bun --compile`), and verify the manifest sha256s in a unit test so a stale or
  hand-edited asset fails CI rather than shipping.
- The wasm binary disappears entirely — native ort has no `ort-wasm-simd-threaded.wasm`.
- Binary size: pyke's prebuilt, statically-linked onnxruntime adds roughly 10–15 MB per
  platform (x86-64 builds target x86-64-v3 / Haswell+, macOS ≥ 13.4, Intel macOS dropped
  [rc.11 notes](https://github.com/pykeio/ort/releases/tag/v2.0.0-rc.11)). Acceptable for
  a CLI that already ships 5.2 MB of assets; `load-dynamic` is the fallback if size
  matters.

## 4. Feasibility risks, ranked

1. **Tokenization parity — premise correction, then golden-test it.** The ticket assumes
   `@huggingface/tokenizers` wraps the Rust crate. It does not: 0.2.0 is Tokenizers.js, a
   pure-JS port, and its README documents deliberate Oniguruma-semantics emulation with
   named residual divergences (full Unicode case folding like `ß`→`ss`, some POSIX
   classes, split behaviors it refuses to emulate). For *this* tokenizer the stack is
   `BertNormalizer`(lowercase, strip_accents=null) + `BertPreTokenizer` + `WordPiece`
   (vocab 30522) + `TemplateProcessing` — no fancy regex — so byte-identical ids are
   expected, including the `remove_space` and added-token splitting behavior. But "book
   title" text is exactly where non-ASCII shows up, so the port should ship a golden
   corpus test: run the TS pipeline and the Rust pipeline over the same real search
   pages and assert identical `input_ids` arrays and identical top-3 element identity.
2. **Float/kernel drift can flip a near-tie.** TS runs ORT-web 1.30 wasm (SIMD, 1
   thread); native ort runs ORT 1.31 CPU (x86-64-v3 kernels, optional multi-thread).
   Scores will match to ~1e-6, not bitwise. Only the *order* of the top 3 is
   user-visible (top-K then first-valid), so drift matters only for near-equal scores —
   assert rank order (with tolerance) on real fixtures rather than exact floats.
3. **int8 support in native ort: not a risk.** The model is Optimum dynamic-quantized
   (`model_int8.onnx` → QOperator `MatMulInteger`-family), fully supported by ORT's CPU
   EP; QDQ fusion is even on by default in ort
   ([with_quant_qdq](https://docs.rs/ort/2.0.0-rc.14/ort/session/builder/struct.SessionBuilder.html#method.with_quant_qdq)).
   One real footnote: on pre-VNNI x86-64 the U8S8 kernels can overflow — ort exposes
   `with_precise_qmm` exactly for this; enable it defensively or verify on the oldest
   supported CPU.
4. **DOM-side behavior change is the bigger user-visible risk than the model.** The
   pipeline's *output* is an element choice; swapping linkedom for scraper/html5ever can
   change edge-case parsing (attribute order, `<noscript>`, malformed tables) long before
   any float drift matters. The selectors/DOM-path store keys (`host|task` → tag/nth
   path) must survive: a `selectors.json` written by the TS app should still resolve in
   the Rust app, or learned selectors invalidate on upgrade.
5. **Performance: strictly better native.** No wasm compile step on first ranked-stage
   hit (today's first-resolution latency pays wasm init + session create), no
   `numThreads = 1` ceiling, smaller allocations (`Session::run` allocation overhead was
   reduced in rc.14). The TinyBERT model at seq ≤ 256 is milliseconds either way; the
   win is load time and the download-link validator's network fetches dominating as
   before.
6. **Version skew:** ORT-web 1.30 → native 1.31 (same engine). ort is still
   release-candidate software (`2.0.0-rc.x`) — pin exactly (`=2.0.0-rc.15`) and expect
   breaking API churn until 2.0.0.
7. **Stage-failure semantics:** port `77eb40e`'s degrade-don't-reject behavior (a
   throwing stage = zero proposals), otherwise a native ort init failure would crash the
   app where the TS app already degrades.

## Sources

- Repo: `src/api/resolution/**`, `src/api/services/app-services.ts`,
  `src/api/download/download-page-resolver.ts`, `src/api/adapters/libgen-plus-adapter.ts`,
  `scripts/models/{manifest,pinned-model-fetcher,types}.ts`, `assets/models/reranker/*`
  (input/output tensor names extracted from `model.onnx`).
- [ort docs — Session / SessionBuilder (2.0.0-rc.14)](https://docs.rs/ort/2.0.0-rc.14/ort/)
- [pykeio/ort releases (rc.11→rc.15: ORT 1.31, Environment API, static linking, binary targets)](https://github.com/pykeio/ort/releases)
- [@huggingface/tokenizers on npm (0.2.0, "pure JS/TS implementation")](https://www.npmjs.com/package/@huggingface/tokenizers)
- [huggingface/tokenizers.js — Tokenizer.ts (encode semantics read line-by-line)](https://github.com/huggingface/tokenizers.js/blob/main/src/core/Tokenizer.ts)
- [huggingface/tokenizers releases (0.22→0.23 stable, 1.0.0-rc.4)](https://github.com/huggingface/tokenizers/releases) and
  [tokenizer/mod.rs v0.23.2 (from_bytes/encode pair API)](https://github.com/huggingface/tokenizers/blob/v0.23.2/tokenizers/src/tokenizer/mod.rs)
