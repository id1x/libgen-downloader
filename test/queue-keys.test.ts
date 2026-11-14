import { afterEach, describe, expect, it } from "bun:test";
import { useBoundStore } from "../src/tui/store";
import type { TCombinedStore } from "../src/tui/store";
import type { Entry } from "../src/api/models/entry";
import { DownloadStatus } from "../src/download-statuses";
import {
  actOnCursorRow,
  moveQueueCursorBy,
  removeBulkUnderCursor,
  retryFailedBulk,
} from "../src/tui/layouts/browse/queue-keys";

const originalStoreState = useBoundStore.getState();

afterEach(() => {
  useBoundStore.setState(originalStoreState, true);
});

const entryWithMD5 = (md5: string, id: string): Entry => ({
  id,
  authors: "A. Author",
  title: "A Title",
  publisher: "Publisher",
  year: "2019",
  pages: "388",
  language: "English",
  size: "14 MB",
  extension: "pdf",
  mirror: `https://mirror-a.example/ads.php?md5=${md5}`,
});

const adapter = {
  getEntryMD5: (entry: Entry): string | undefined => {
    const match = entry.mirror.match(/md5=([0-9a-f]+)/);
    return match?.[1];
  },
} as unknown as TCombinedStore["mirrorAdapter"];

const bulkItem = (md5: string, status: DownloadStatus) => ({
  md5,
  filename: "file.pdf",
  total: 100,
  progress: 0,
  status,
});

const directProgress = (status: DownloadStatus) => ({
  filename: "file.pdf",
  total: 100,
  progress: 0,
  status,
});

const entry = entryWithMD5("9f3c2a7eb41d00000000000000000000", "entry-1");

describe("retryFailedBulk", () => {
  it("no-ops while the bulk run is still going", () => {
    let retries = 0;
    useBoundStore.setState({
      isBulkDownloadComplete: false,
      failedBulkDownloadItemCount: 2,
      retryFailedBulkDownloads: () => {
        retries += 1;
      },
    } as Partial<TCombinedStore>);

    retryFailedBulk();

    expect(retries).toBe(0);
  });

  it("no-ops for a settled run without failures", () => {
    let retries = 0;
    useBoundStore.setState({
      isBulkDownloadComplete: true,
      failedBulkDownloadItemCount: 0,
      retryFailedBulkDownloads: () => {
        retries += 1;
      },
    } as Partial<TCombinedStore>);

    retryFailedBulk();

    expect(retries).toBe(0);
  });

  it("retries when the run is complete and has failures (spec §4)", () => {
    let retries = 0;
    useBoundStore.setState({
      isBulkDownloadComplete: true,
      failedBulkDownloadItemCount: 2,
      retryFailedBulkDownloads: () => {
        retries += 1;
      },
    } as Partial<TCombinedStore>);

    retryFailedBulk();

    expect(retries).toBe(1);
  });
});

describe("removeBulkUnderCursor", () => {
  it("ignores `x` while a run is in flight (spec §4)", () => {
    const removed: Entry[] = [];
    useBoundStore.setState({
      entries: [entry],
      mirrorAdapter: adapter,
      bulkDownloadSelectedEntries: { [`${entry.id}-hash`]: entry },
      queueCursor: 0,
      bulkDownloadQueue: [bulkItem("9f3c2a7eb41d00000000000000000000", DownloadStatus.DOWNLOADING)],
      isBulkDownloadComplete: false,
      removeFromBulkDownloadQueue: (candidate: Entry) => {
        removed.push(candidate);
      },
    } as Partial<TCombinedStore>);

    removeBulkUnderCursor();

    expect(removed).toEqual([]);
  });

  it("removes the selected entry under the cursor before a run starts", () => {
    const removed: Entry[] = [];
    useBoundStore.setState({
      entries: [entry],
      mirrorAdapter: adapter,
      bulkDownloadSelectedEntries: { [`${entry.id}-hash`]: entry },
      queueCursor: 0,
      bulkDownloadQueue: [],
      removeFromBulkDownloadQueue: (candidate: Entry) => {
        removed.push(candidate);
      },
    } as Partial<TCombinedStore>);

    removeBulkUnderCursor();

    expect(removed).toEqual([entry]);
  });

  it("removes again once the run has settled", () => {
    const removed: Entry[] = [];
    useBoundStore.setState({
      entries: [entry],
      mirrorAdapter: adapter,
      bulkDownloadSelectedEntries: { [`${entry.id}-hash`]: entry },
      queueCursor: 0,
      bulkDownloadQueue: [bulkItem("9f3c2a7eb41d00000000000000000000", DownloadStatus.FAILED)],
      isBulkDownloadComplete: true,
      removeFromBulkDownloadQueue: (candidate: Entry) => {
        removed.push(candidate);
      },
    } as Partial<TCombinedStore>);

    removeBulkUnderCursor();

    expect(removed).toEqual([entry]);
  });
});

describe("moveQueueCursorBy", () => {
  it("clamps to the last actionable row", () => {
    useBoundStore.setState({
      bulkDownloadQueue: [
        bulkItem("9f3c2a7eb41d00000000000000000000", DownloadStatus.IN_QUEUE),
        bulkItem("02000002000000000000000000000002", DownloadStatus.IN_QUEUE),
      ],
      queueCursor: 0,
    });

    moveQueueCursorBy(10);

    expect(useBoundStore.getState().queueCursor).toBe(1);
  });

  it("clamps at the first row", () => {
    useBoundStore.setState({
      bulkDownloadQueue: [
        bulkItem("9f3c2a7eb41d00000000000000000000", DownloadStatus.IN_QUEUE),
        bulkItem("02000002000000000000000000000002", DownloadStatus.IN_QUEUE),
      ],
      queueCursor: 1,
    });

    moveQueueCursorBy(-5);

    expect(useBoundStore.getState().queueCursor).toBe(0);
  });
});

// A direct-download row under the cursor: the entry is in the results and
// has a downloadProgressMap record, so the row maps to it.
const seedDirectRow = () => {
  useBoundStore.setState({
    entries: [entry],
    downloadProgressMap: { [entry.id]: directProgress(DownloadStatus.IN_QUEUE) },
    queueCursor: 0,
  });
};

describe("actOnCursorRow", () => {
  it("downloads the cursor entry on `d`", () => {
    seedDirectRow();
    const downloaded: Entry[] = [];
    useBoundStore.setState({
      pushDownloadQueue: (candidate: Entry) => {
        downloaded.push(candidate);
      },
    } as Partial<TCombinedStore>);

    actOnCursorRow("download", () => {});

    expect(downloaded).toEqual([entry]);
  });

  it("toggles the cursor entry's bulk selection on `space`", () => {
    seedDirectRow();
    const toggled: Entry[] = [];

    actOnCursorRow("toggle", (candidate: Entry) => {
      toggled.push(candidate);
    });

    expect(toggled).toEqual([entry]);
  });

  it("no-ops when the cursor row maps to no result entry", () => {
    useBoundStore.setState({
      bulkDownloadQueue: [bulkItem("ffffffffffffffffffffffffffffffff", DownloadStatus.IN_QUEUE)],
      queueCursor: 0,
    });
    const downloaded: Entry[] = [];
    const toggled: Entry[] = [];
    useBoundStore.setState({
      pushDownloadQueue: (candidate: Entry) => {
        downloaded.push(candidate);
      },
    } as Partial<TCombinedStore>);

    actOnCursorRow("download", (candidate: Entry) => {
      toggled.push(candidate);
    });

    expect(downloaded).toEqual([]);
    expect(toggled).toEqual([]);
  });
});
