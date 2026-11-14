import { afterEach, describe, expect, it } from "bun:test";
import objectHash from "object-hash";
import { LibgenPlusAdapter } from "../src/api/adapters/libgen-plus-adapter";
import type { Entry } from "../src/api/models/entry";
import { DownloadStatus } from "../src/download-statuses";
import { useBoundStore } from "../src/tui/store";

const BASE_URL = "https://libgen.example/";
const originalStoreState = useBoundStore.getState();

const createEntry = (id: string, md5: string): Entry => {
  return {
    id,
    authors: "Example Author",
    title: `Example Book ${id}`,
    publisher: "Example Press",
    year: "2026",
    pages: "100",
    language: "English",
    size: "1 KB",
    extension: "epub",
    mirror: `/ads.php?md5=${md5}`,
  };
};

const queueItem = (md5: string, status: DownloadStatus) => {
  return {
    md5,
    filename: "",
    total: 0,
    progress: 0,
    status,
  };
};

afterEach(() => {
  useBoundStore.setState(originalStoreState, true);
});

describe("settleBulkRun", () => {
  it("deselects the entries the run completed", () => {
    const done = createEntry("entry-1", "aaa");
    useBoundStore.setState({
      mirrorAdapter: new LibgenPlusAdapter(BASE_URL),
      bulkDownloadSelectedEntries: { [objectHash(done)]: done },
      bulkDownloadQueue: [queueItem("aaa", DownloadStatus.DOWNLOADED)],
      isBulkDownloadComplete: true,
    });

    useBoundStore.getState().settleBulkRun();

    expect(useBoundStore.getState().bulkDownloadSelectedEntries).toEqual({});
  });

  it("keeps the failed entries selected for retry", () => {
    const failed = createEntry("entry-2", "bbb");
    useBoundStore.setState({
      mirrorAdapter: new LibgenPlusAdapter(BASE_URL),
      bulkDownloadSelectedEntries: { [objectHash(failed)]: failed },
      bulkDownloadQueue: [queueItem("bbb", DownloadStatus.FAILED)],
      isBulkDownloadComplete: true,
    });

    useBoundStore.getState().settleBulkRun();

    expect(useBoundStore.getState().bulkDownloadSelectedEntries).toEqual({
      [objectHash(failed)]: failed,
    });
  });

  it("keeps the finished run's queue for display", () => {
    const failed = createEntry("entry-2", "bbb");
    const queue = [queueItem("aaa", DownloadStatus.DOWNLOADED), queueItem("bbb", DownloadStatus.FAILED)];
    useBoundStore.setState({
      mirrorAdapter: new LibgenPlusAdapter(BASE_URL),
      bulkDownloadSelectedEntries: { [objectHash(failed)]: failed },
      bulkDownloadQueue: queue,
      isBulkDownloadComplete: true,
    });

    useBoundStore.getState().settleBulkRun();

    expect(useBoundStore.getState().bulkDownloadQueue).toEqual(queue);
  });
});
