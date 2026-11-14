// Regression: a search whose results page has no results table must resolve
// to an empty success. It used to fall through every resolution stage into
// the cross-encoder ranker, whose model asset is not fetched in source
// checkouts, and the resulting rejection killed the app (unhandled rejection
// from the automatic next-page check).
import { afterEach, beforeEach, describe, expect, it, mock, spyOn } from "bun:test";
import { LibgenPlusAdapter } from "../src/api/adapters/libgen-plus-adapter";
import { AppServices } from "../src/api/services/app-services";
import { setAppServices } from "../src/api/services/shared-services";
import { initialAppState } from "../src/tui/store/app";
import { initialBulkDownloadQueueState } from "../src/tui/store/bulk-download-queue";
import { initialCacheState } from "../src/tui/store/cache";
import { initialConfigState } from "../src/tui/store/config";
import { initialDownloadQueueState } from "../src/tui/store/download-queue";
import { useBoundStore } from "../src/tui/store";
import { MemorySelectorStore } from "./support/memory-selector-store";

const BASE_URL = "https://libgen.example/";
const originalStoreState = useBoundStore.getState();

// Minimal shape of a libgen+ page without results (captured from a live
// mirror): no `#tablelibgen`, only the bare Show Covers / Show chapters
// options table — one row, two cells, no header cells, no links.
const EMPTY_RESULTS_PAGE = `<html><body>
  <div class="d-block">
    <table><tr><td><div class="custom-control custom-switch">Show Covers</div></td><td><div class="custom-control custom-switch">Show chapters</div></td></tr></table>
  </div>
</body></html>`;

beforeEach(() => {
  // The default services point the learned-selector store at the real user
  // cache; the memory store keeps the resolution chain deterministic.
  setAppServices(new AppServices({ selectorStore: new MemorySelectorStore() }));
  useBoundStore.setState(
    {
      ...originalStoreState,
      ...initialAppState,
      ...initialConfigState,
      ...initialCacheState,
      ...initialDownloadQueueState,
      ...initialBulkDownloadQueueState,
      CLIMode: true,
      mirror: { src: BASE_URL, type: "libgen-plus" },
      mirrors: [{ src: BASE_URL, type: "libgen-plus" }],
      mirrorAdapter: new LibgenPlusAdapter(BASE_URL),
    },
    true
  );
});

afterEach(() => {
  mock.restore();
  setAppServices(undefined);
  useBoundStore.setState(originalStoreState, true);
});

describe("search on a results page without a results table", () => {
  it("resolves to an empty success instead of dying in the reranker", async () => {
    spyOn(globalThis, "fetch").mockResolvedValue(new Response(EMPTY_RESULTS_PAGE));

    const result = await useBoundStore
      .getState()
      .search("Trajectory Planning for Automatic Machines and Robots", 2);

    expect(result).toEqual({ status: "success", entries: [] });
  });
});
