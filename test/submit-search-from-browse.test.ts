import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import type { Entry } from "../src/api/models/entry";
import { DownloadStatus } from "../src/download-statuses";
import { LAYOUT_KEY } from "../src/tui/layouts/keys";
import { initialAppState } from "../src/tui/store/app";
import { initialBrowseState } from "../src/tui/store/browse";
import { initialBulkDownloadQueueState } from "../src/tui/store/bulk-download-queue";
import { initialCacheState } from "../src/tui/store/cache";
import { initialDownloadQueueState } from "../src/tui/store/download-queue";
import { useBoundStore } from "../src/tui/store";

const originalStoreState = useBoundStore.getState();

const createEntry = (id: string): Entry => {
  return {
    id,
    authors: "",
    title: id,
    publisher: "",
    year: "",
    pages: "",
    language: "",
    size: "",
    extension: "",
    mirror: "",
  };
};

beforeEach(() => {
  useBoundStore.setState(
    {
      ...originalStoreState,
      ...initialAppState,
      ...initialBrowseState,
      ...initialBulkDownloadQueueState,
      ...initialCacheState,
      ...initialDownloadQueueState,
      CLIMode: true,
      setWarningMessage: mock(() => {}),
    },
    true
  );
});

afterEach(() => {
  mock.restore();
  useBoundStore.setState(originalStoreState, true);
});

const seedSearch = (entries: Entry[]) => {
  const search = mock(async () => ({ status: "success" as const, entries }));
  const checkNextPage = mock(() => {});
  useBoundStore.setState({ search, checkNextPage });
  return { search };
};

describe("submitSearchFromBrowse", () => {
  it("runs the draft in place, resets the page state and keeps selections and progress", async () => {
    const keptEntry = createEntry("kept-entry");
    const { search } = seedSearch([createEntry("fresh-entry")]);
    useBoundStore.setState({
      searchDraft: "new query",
      searchValue: "old query",
      currentPage: 4,
      listItemsCursor: 7,
      nextPageStatus: "ready",
      entryCacheMap: { "https://old.example/?req=old": [keptEntry] },
      bulkDownloadSelectedEntries: { "hash-kept": keptEntry },
      downloadProgressMap: {
        "kept-entry": {
          filename: "kept.pdf",
          total: 10,
          progress: 4,
          status: DownloadStatus.DOWNLOADING,
        },
      },
    });

    await useBoundStore.getState().submitSearchFromBrowse();

    const state = useBoundStore.getState();
    expect(state.searchValue).toBe("new query");
    expect(state.currentPage).toBe(1);
    expect(state.listItemsCursor).toBe(0);
    expect(state.nextPageStatus).toBe("idle");
    expect(state.entryCacheMap).toEqual({});
    // The search runs without switching layouts (spec §5.4).
    expect(state.activeLayout).toBe(LAYOUT_KEY.BROWSE_LAYOUT);
    expect(state.entries).toEqual([createEntry("fresh-entry")]);
    expect(state.isLoading).toBe(false);
    expect(state.browseFocus).toBe("list");
    expect(state.searchDraft).toBe("");
    expect(search).toHaveBeenCalledWith("new query", 1);
    expect(state.searchHistory).toEqual(["new query"]);
    // Bulk selections and the download progress map survive (spec §5.4).
    expect(Object.values(state.bulkDownloadSelectedEntries)).toEqual([keptEntry]);
    expect(state.downloadProgressMap["kept-entry"]?.status).toBe(DownloadStatus.DOWNLOADING);
  });

  it("keeps a session history of the last 10 queries, newest first, deduplicated", async () => {
    seedSearch([]);

    for (let index = 1; index <= 12; index++) {
      useBoundStore.setState({ searchDraft: `query-${index}` });
      await useBoundStore.getState().submitSearchFromBrowse();
    }

    let state = useBoundStore.getState();
    expect(state.searchHistory).toEqual([
      "query-12",
      "query-11",
      "query-10",
      "query-9",
      "query-8",
      "query-7",
      "query-6",
      "query-5",
      "query-4",
      "query-3",
    ]);

    // Re-running an older query moves it to the front instead of duplicating it.
    useBoundStore.setState({ searchDraft: "query-5" });
    await useBoundStore.getState().submitSearchFromBrowse();

    state = useBoundStore.getState();
    expect(state.searchHistory).toEqual([
      "query-5",
      "query-12",
      "query-11",
      "query-10",
      "query-9",
      "query-8",
      "query-7",
      "query-6",
      "query-4",
      "query-3",
    ]);
  });
});
